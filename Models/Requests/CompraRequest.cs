using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class CompraRequest
{
    [Range(1, 999999)] public int SupplierId { get; set; }
    [Required][StringLength(40)] public string Document { get; set; } = "";
    [Required][MinLength(1)][MaxLength(100)] public List<DetalleCompraRequest> Items { get; set; } = [];
}
