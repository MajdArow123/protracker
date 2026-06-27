using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Common;

namespace ProTracker.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public abstract class ApiControllerBase : ControllerBase
{
    protected ActionResult Success<T>(T data) => Ok(ApiResponse<T>.Ok(data));

    protected ActionResult Created<T>(T data) => StatusCode(StatusCodes.Status201Created, ApiResponse<T>.Ok(data));

    protected ActionResult NoContentSuccess() => StatusCode(StatusCodes.Status204NoContent);
}
