using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class ClienteRequest
{
    public int? Id { get; set; }
    [Required(ErrorMessage = "Selecciona el tipo de documento.")][StringLength(3)] public string DocType { get; set; } = "";
    [Required(ErrorMessage = "Ingresa el documento.")][StringLength(15)] public string Doc { get; set; } = "";
    [Required(ErrorMessage = "Ingresa el nombre.")][StringLength(160)] public string Name { get; set; } = "";
    [StringLength(20)] public string Phone { get; set; } = "";
}
