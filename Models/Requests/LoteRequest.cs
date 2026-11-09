using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class LoteRequest
{
    [Range(1, 999999)] public int ProductId { get; set; }
    [Required][StringLength(60)] public string Code { get; set; } = "";
    [Required][StringLength(10)] public string Expiry { get; set; } = "";
    [Range(0, 999999)] public int Min { get; set; }
}
