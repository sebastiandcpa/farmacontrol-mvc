using FarmaControl.Data;
using FarmaControl.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

public sealed class ProveedoresController(Repository repository) : OperationController(repository)
{
    [Authorize(Roles = "Administrador,Almacenero")]
    [HttpPost("/api/proveedores")]
    [HttpPost("/api/operations/supplier")]
    public Task<IActionResult> Registrar(ProveedorRequest input) => Execute("supplier", input);
}
