using ProTracker.Common;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace ProTracker.Services;

public interface IImageService
{
    // Validates + center-crops the upload to a size×size JPEG and returns it as a
    // base64 data URL (images are stored in the DB — Railway has no persistent disk).
    Task<string> ToSquareJpegDataUrlAsync(IFormFile file, int size);
}

public class ImageService : IImageService
{
    private const long MaxBytes = 5 * 1024 * 1024; // 5MB
    private static readonly string[] AllowedTypes = { "image/jpeg", "image/png", "image/webp" };

    public async Task<string> ToSquareJpegDataUrlAsync(IFormFile file, int size)
    {
        if (file == null || file.Length == 0)
            throw new ValidationApiException("No image file was uploaded.");
        if (file.Length > MaxBytes)
            throw new ValidationApiException("Image is too large — maximum size is 5MB.");
        if (!AllowedTypes.Contains(file.ContentType?.ToLowerInvariant()))
            throw new ValidationApiException("Unsupported image format — use JPEG, PNG, or WebP.");

        try
        {
            await using var stream = file.OpenReadStream();
            using var image = await Image.LoadAsync(stream);

            // Crop-to-cover: fills the square then trims overflow, so faces aren't squashed.
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(size, size),
                Mode = ResizeMode.Crop,
            }));

            using var output = new MemoryStream();
            await image.SaveAsync(output, new JpegEncoder { Quality = 82 });
            return $"data:image/jpeg;base64,{Convert.ToBase64String(output.ToArray())}";
        }
        catch (Exception ex) when (ex is not ValidationApiException)
        {
            // Covers corrupt files and content that doesn't match its declared type.
            throw new ValidationApiException("Could not process that image — the file may be corrupted.");
        }
    }
}
