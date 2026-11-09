using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class MedicamentoRequest
{
    public int? Id { get; set; }
    [Required][StringLength(30)] public string Sku { get; set; } = "";
    [Required][StringLength(160)] public string Name { get; set; } = "";
    [Required][StringLength(90)] public string Category { get; set; } = "";
    [Required][StringLength(90)] public string Presentation { get; set; } = "";
    [Range(typeof(decimal), "0", "999999")] public decimal Price { get; set; }
    public bool Rx { get; set; }
}
