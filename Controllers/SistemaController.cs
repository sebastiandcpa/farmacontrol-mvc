using FarmaControl.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

[ApiController]
[AllowAnonymous]
public sealed class SistemaController(Repository repository) : ControllerBase
{
    [HttpGet("/health")]
    public async Task<IActionResult> Estado() => Ok(new { application = "FarmaControl", database = "SQL Server", connected = await repository.Connected(), version = "0.8.1", architecture = "MVC" });
}
