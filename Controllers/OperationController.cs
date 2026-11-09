using System.Security.Claims;
using System.Text.Json;
using FarmaControl.Data;
using FarmaControl.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

[ApiController]
[Authorize]
public abstract class OperationController(Repository repository) : ControllerBase
{
    protected async Task<IActionResult> Execute<T>(string action, T input)
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var actor = await repository.User(id) ?? throw new RuleError("La sesión ya no está disponible.", 401);
        var operationId = await repository.Apply(action, JsonSerializer.SerializeToElement(input, new JsonSerializerOptions(JsonSerializerDefaults.Web)), actor);
        return Ok(await repository.State(id, operationId));
    }
}
