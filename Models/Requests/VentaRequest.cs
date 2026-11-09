using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class VentaRequest
{
    [Range(1, 999999)] public int ClientId { get; set; }
    [Required][RegularExpression("BOLETA|FACTURA")] public string Type { get; set; } = "";
    public int? RecipeId { get; set; }
    [Required][MinLength(1)][MaxLength(100)] public List<DetalleVentaRequest> Items { get; set; } = [];
}
