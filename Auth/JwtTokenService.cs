using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Auth;

public class JwtTokenService : IJwtTokenService
{
    private readonly ApplicationDbContext _context;
    private readonly JwtSettings _settings;
    private readonly SymmetricSecurityKey _signingKey;

    public JwtTokenService(ApplicationDbContext context, IOptions<JwtSettings> options)
    {
        _context = context;
        _settings = options.Value;
        _signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SigningKey));
    }

    public string CreateAccessToken(ApplicationUser user, IList<string> roles)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email ?? ""),
            new("displayName", user.DisplayName)
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_settings.AccessTokenMinutes),
            signingCredentials: new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<string> CreateRefreshTokenAsync(string userId)
    {
        var rawToken = GenerateRawToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = userId,
            TokenHash = Hash(rawToken),
            ExpiresAt = DateTime.UtcNow.AddDays(_settings.RefreshTokenDays)
        });
        await _context.SaveChangesAsync();

        return rawToken;
    }

    public async Task<(string UserId, string NewRawRefreshToken)?> ValidateAndRotateRefreshTokenAsync(string rawToken)
    {
        var hash = Hash(rawToken);
        var existing = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (existing == null)
            return null;

        // Reuse of an already-rotated/revoked token is a strong signal of theft — revoke the
        // whole chain defensively rather than silently issuing a new token.
        if (!existing.IsActive)
        {
            if (existing.ReplacedByTokenHash != null)
                await RevokeChainAsync(existing.UserId);
            return null;
        }

        var newRawToken = GenerateRawToken();
        var newHash = Hash(newRawToken);

        existing.RevokedAt = DateTime.UtcNow;
        existing.ReplacedByTokenHash = newHash;

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = existing.UserId,
            TokenHash = newHash,
            ExpiresAt = DateTime.UtcNow.AddDays(_settings.RefreshTokenDays)
        });

        await _context.SaveChangesAsync();

        return (existing.UserId, newRawToken);
    }

    public async Task RevokeRefreshTokenAsync(string rawToken)
    {
        var hash = Hash(rawToken);
        var existing = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (existing != null && existing.RevokedAt == null)
        {
            existing.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public ClaimsPrincipal? ValidateAccessToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _settings.Issuer,
                ValidateAudience = true,
                ValidAudience = _settings.Audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = _signingKey,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            }, out _);
            return principal;
        }
        catch
        {
            return null;
        }
    }

    private async Task RevokeChainAsync(string userId)
    {
        var tokens = await _context.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var t in tokens)
            t.RevokedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    private static string GenerateRawToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static string Hash(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToBase64String(bytes);
    }
}
