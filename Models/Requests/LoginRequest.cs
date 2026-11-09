using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class LoginRequest
{
    [Required(ErrorMessage = "Ingresa el correo.")][EmailAddress(ErrorMessage = "Ingresa un correo válido.")] public string Email { get; set; } = "";
    [Required(ErrorMessage = "Ingresa la contraseña.")][StringLength(128)] public string Password { get; set; } = "";
}
