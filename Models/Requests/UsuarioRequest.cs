using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class UsuarioRequest
{
    [Required][StringLength(120)] public string Name { get; set; } = "";
    [Required][EmailAddress][StringLength(160)] public string Email { get; set; } = "";
    [Required][StringLength(40)] public string Role { get; set; } = "";
    [Required][StringLength(128, MinimumLength = 10)] public string Password { get; set; } = "";
}
