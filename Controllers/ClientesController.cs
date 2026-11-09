using FarmaControl.Data;
using FarmaControl.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

public sealed class ClientesController(Repository repository) : OperationController(repository)
{
    [Authorize(Roles = "Administrador,Cajero")]
    [HttpPost("/api/clientes")]
    [HttpPost("/api/operations/client")]
    public Task<IActionResult> Guardar(ClienteRequest input) => Execute("client", input);
}
