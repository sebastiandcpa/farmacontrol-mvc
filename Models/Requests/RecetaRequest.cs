using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class RecetaRequest
{
    [Range(1, 999999)] public int ClientId { get; set; }
    [Required][StringLength(50)] public string Code { get; set; } = "";
    [Required][StringLength(160)] public string Prescriber { get; set; } = "";
    [Required][StringLength(10)] public string Issued { get; set; } = "";
    [Required][StringLength(10)] public string Expiry { get; set; } = "";
}
