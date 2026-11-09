using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class ProveedorRequest
{
    [Required][RegularExpression(@"^\d{11}$")] public string Ruc { get; set; } = "";
    [Required][StringLength(180)] public string Name { get; set; } = "";
    [StringLength(20)] public string Phone { get; set; } = "";
}
