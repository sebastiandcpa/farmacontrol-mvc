using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class DetalleCompraRequest
{
    [Range(1, 999999)] public int LotId { get; set; }
    [Range(1, 999999)] public int Qty { get; set; }
    [Range(typeof(decimal), "0", "999999")] public decimal Price { get; set; }
}
