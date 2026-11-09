using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class DetalleVentaRequest
{
    [Range(1, 999999)] public int LotId { get; set; }
    [Range(1, 999999)] public int Qty { get; set; }
}
