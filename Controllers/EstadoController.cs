using System.Security.Claims;
using FarmaControl.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

[ApiController]
[Authorize]
public sealed class EstadoController(Repository repository) : ControllerBase
{
    [HttpGet("/api/state")]
    public async Task<IActionResult> Consultar() => Ok(await repository.State(int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!)));
}
