using FarmaControl.Data;
using FarmaControl.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

public sealed class UsuariosController(Repository repository) : OperationController(repository)
{
    [Authorize(Roles = "Administrador")]
    [HttpPost("/api/usuarios")]
    [HttpPost("/api/operations/user")]
    public Task<IActionResult> Registrar(UsuarioRequest input) => Execute("user", input);

    [Authorize(Roles = "Administrador")]
    [HttpPost("/api/usuarios/estado")]
    [HttpPost("/api/operations/userToggle")]
    public Task<IActionResult> CambiarEstado(IdentificadorRequest input) => Execute("userToggle", input);
}
