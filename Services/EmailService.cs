using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ProTracker.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string resetUrl);
    Task SendParentInviteAsync(string toEmail, string inviteUrl, string playerName, string coachName);
    Task SendAthleteInviteAsync(string toEmail, string joinUrl, string teamName, string coachName);
}

// Sends transactional email over SMTP (MailKit). If no SMTP config is present — or if
// sending fails — it gracefully falls back to logging the reset URL so the flow stays
// testable in local dev / on a portfolio deployment without an email provider.
public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendPasswordResetAsync(string toEmail, string resetUrl)
    {
        var host = _config["SMTP_HOST"];
        var from = _config["EMAIL_FROM"] ?? "noreply@protracker.app";

        if (string.IsNullOrWhiteSpace(host))
        {
            // No SMTP configured — log the link so it can be used for testing.
            _logger.LogInformation("[PasswordReset] No SMTP configured. Reset link for {Email}: {Url}", toEmail, resetUrl);
            return;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(from));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = "Reset your ProTracker password";
            message.Body = new BodyBuilder { HtmlBody = BuildHtml(resetUrl) }.ToMessageBody();

            var port = int.TryParse(_config["SMTP_PORT"], out var p) ? p : 587;
            var user = _config["SMTP_USER"];
            var pass = _config["SMTP_PASS"];

            using var client = new SmtpClient();
            // STARTTLS on 587, implicit TLS on 465.
            var socketOption = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await client.ConnectAsync(host, port, socketOption);
            if (!string.IsNullOrWhiteSpace(user))
                await client.AuthenticateAsync(user, pass);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            _logger.LogInformation("[PasswordReset] Sent reset email to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            // Never fail the request because email failed — log the link so it's still usable.
            _logger.LogError(ex, "[PasswordReset] Failed to send email to {Email}. Reset link: {Url}", toEmail, resetUrl);
        }
    }

    public async Task SendParentInviteAsync(string toEmail, string inviteUrl, string playerName, string coachName)
    {
        var host = _config["SMTP_HOST"];
        var from = _config["EMAIL_FROM"] ?? "noreply@protracker.app";

        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogInformation("[ParentInvite] No SMTP configured. Invite link for {Email}: {Url}", toEmail, inviteUrl);
            return;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(from));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = $"You've been invited to follow {playerName} on ProTracker";
            message.Body = new BodyBuilder { HtmlBody = BuildInviteHtml(inviteUrl, playerName, coachName) }.ToMessageBody();

            var port = int.TryParse(_config["SMTP_PORT"], out var p) ? p : 587;
            var user = _config["SMTP_USER"];
            var pass = _config["SMTP_PASS"];

            using var client = new SmtpClient();
            var socketOption = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await client.ConnectAsync(host, port, socketOption);
            if (!string.IsNullOrWhiteSpace(user))
                await client.AuthenticateAsync(user, pass);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            _logger.LogInformation("[ParentInvite] Sent invite email to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ParentInvite] Failed to send email to {Email}. Invite link: {Url}", toEmail, inviteUrl);
        }
    }

    public async Task SendAthleteInviteAsync(string toEmail, string joinUrl, string teamName, string coachName)
    {
        var host = _config["SMTP_HOST"];
        var from = _config["EMAIL_FROM"] ?? "noreply@protracker.app";

        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogInformation("[AthleteInvite] No SMTP configured. Join link for {Email}: {Url}", toEmail, joinUrl);
            return;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(from));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = $"Join {teamName} on ProTracker";
            message.Body = new BodyBuilder { HtmlBody = BuildAthleteInviteHtml(joinUrl, teamName, coachName) }.ToMessageBody();

            var port = int.TryParse(_config["SMTP_PORT"], out var p) ? p : 587;
            var user = _config["SMTP_USER"];
            var pass = _config["SMTP_PASS"];

            using var client = new SmtpClient();
            var socketOption = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await client.ConnectAsync(host, port, socketOption);
            if (!string.IsNullOrWhiteSpace(user))
                await client.AuthenticateAsync(user, pass);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            _logger.LogInformation("[AthleteInvite] Sent join invite email to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AthleteInvite] Failed to send email to {Email}. Join link: {Url}", toEmail, joinUrl);
        }
    }

    private static string BuildAthleteInviteHtml(string joinUrl, string teamName, string coachName) => $$"""
<!doctype html>
<html>
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#0f172a; padding:32px;">
  <div style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:24px 28px;">
      <h1 style="color:#fff; margin:0; font-size:20px;">ProTracker</h1>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 12px; font-size:18px; color:#0f172a;">You're invited to join {{teamName}}</h2>
      <p style="color:#475569; font-size:14px; line-height:1.6;">
        {{coachName}} has invited you to join <strong>{{teamName}}</strong> on ProTracker.
        Create your athlete account to track your assessments, training, nutrition and progress.
      </p>
      <a href="{{joinUrl}}" style="display:inline-block; margin-top:16px; background:#6366f1; color:#fff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:600; font-size:14px;">Join the team</a>
      <p style="color:#94a3b8; font-size:12px; margin-top:20px;">If you weren't expecting this, you can ignore it.</p>
    </div>
  </div>
</body>
</html>
""";

    private static string BuildInviteHtml(string inviteUrl, string playerName, string coachName) => $$"""
<!doctype html>
<html>
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#0f172a; padding:32px;">
  <div style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:24px 28px;">
      <h1 style="color:#fff; margin:0; font-size:20px;">ProTracker</h1>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 12px; font-size:18px; color:#0f172a;">Follow {{playerName}}'s progress</h2>
      <p style="color:#475569; font-size:14px; line-height:1.6;">
        {{coachName}} has invited you to a read-only ProTracker account so you can follow
        {{playerName}}'s assessments, fitness, sessions, tasks and wellbeing. Set a password to get started.
      </p>
      <a href="{{inviteUrl}}" style="display:inline-block; margin-top:16px; background:#6366f1; color:#fff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:600; font-size:14px;">Accept invite</a>
      <p style="color:#94a3b8; font-size:12px; margin-top:20px;">This link expires in 7 days. If you weren't expecting this, you can ignore it.</p>
    </div>
  </div>
</body>
</html>
""";

    private static string BuildHtml(string resetUrl) => $$"""
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="background:#0f1117;padding:22px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">ProTracker</span>
          </td></tr>
          <tr><td style="padding:32px 28px;color:#111827;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Reset Your Password</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#4b5563;">
              You requested a password reset for your ProTracker account.
            </p>
            <a href="{{resetUrl}}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:10px;">Reset Password</a>
            <p style="margin:22px 0 6px;font-size:13px;color:#6b7280;">This link expires in 1 hour.</p>
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">If you didn't request this, you can safely ignore this email.</p>
            <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">Or paste this link: {{resetUrl}}</p>
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">© ProTracker</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
""";
}
