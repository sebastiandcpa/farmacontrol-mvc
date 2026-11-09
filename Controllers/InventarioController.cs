using FarmaControl.Data;
using FarmaControl.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

public sealed class InventarioController(Repository repository) : OperationController(repository)
{
    [Authorize(Roles = "Administrador,Almacenero")]
    [HttpPost("/api/medicamentos")]
    [HttpPost("/api/operations/product")]
    public Task<IActionResult> GuardarMedicamento(MedicamentoRequest input) => Execute("product", input);

    [Authorize(Roles = "Administrador,Almacenero")]
    [HttpPost("/api/lotes")]
    [HttpPost("/api/operations/lot")]
    public Task<IActionResult> RegistrarLote(LoteRequest input) => Execute("lot", input);
}
