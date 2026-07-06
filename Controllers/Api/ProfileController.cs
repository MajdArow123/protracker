using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/profile")]
public class ProfileController : ApiControllerBase
{
    private readonly IProfileService _service;

    public ProfileController(IProfileService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult> Get() => Success(await _service.GetAsync(User));

    [HttpPut]
    public async Task<ActionResult> Update(ProfileUpdateRequest request) =>
        Success(await _service.UpdateAsync(User, request));

    [HttpPost("picture")]
    [RequestSizeLimit(6 * 1024 * 1024)] // a little headroom over the 5MB image cap
    public async Task<ActionResult> UploadPicture(IFormFile file) =>
        Success(new ProfilePictureResponse { ProfilePictureUrl = await _service.SetPictureAsync(User, file) });

    [HttpDelete("picture")]
    public async Task<ActionResult> RemovePicture()
    {
        await _service.RemovePictureAsync(User);
        return Success(new ProfilePictureResponse { ProfilePictureUrl = null });
    }

    [HttpPost("onboarding-complete")]
    public async Task<ActionResult> CompleteOnboarding()
    {
        await _service.CompleteOnboardingAsync(User);
        return Success(new GenericMessageResponse { Message = "Onboarding complete." });
    }

    [HttpPost("change-password")]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest request)
    {
        await _service.ChangePasswordAsync(User, request);
        return Success(new GenericMessageResponse { Message = "Password updated." });
    }

    [HttpDelete]
    public async Task<ActionResult> DeleteAccount(DeleteAccountRequest request)
    {
        await _service.DeleteAccountAsync(User, request);
        return NoContentSuccess();
    }
}
