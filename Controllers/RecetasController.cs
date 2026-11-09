using FarmaControl.Data;
using FarmaControl.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

public sealed class RecetasController(Repository repository) : OperationController(repository)
{
    [Authorize(Roles = "Químico farmacéutico")]
    [HttpPost("/api/recetas")]
    [HttpPost("/api/operations/recipe")]
    public Task<IActionResult> Registrar(RecetaRequest input) => Execute("recipe", input);
}
