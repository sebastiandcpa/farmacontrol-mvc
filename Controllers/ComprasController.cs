using FarmaControl.Data;
using FarmaControl.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

public sealed class ComprasController(Repository repository) : OperationController(repository)
{
    [Authorize(Roles = "Administrador,Almacenero")]
    [HttpPost("/api/compras")]
    [HttpPost("/api/operations/purchase")]
    public Task<IActionResult> Registrar(CompraRequest input) => Execute("purchase", input);
}
