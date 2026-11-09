using FarmaControl.Data;
using FarmaControl.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

public sealed class VentasController(Repository repository) : OperationController(repository)
{
    [Authorize(Roles = "Administrador,Cajero")]
    [HttpPost("/api/ventas")]
    [HttpPost("/api/operations/sale")]
    public Task<IActionResult> Registrar(VentaRequest input) => Execute("sale", input);

    [Authorize(Roles = "Administrador")]
    [HttpPost("/api/ventas/anular")]
    [HttpPost("/api/operations/cancelSale")]
    public Task<IActionResult> Anular(IdentificadorRequest input) => Execute("cancelSale", input);
}
