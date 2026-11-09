using System.ComponentModel.DataAnnotations;

namespace FarmaControl.Models.Requests;

public sealed class IdentificadorRequest
{
    [Range(1, 999999)] public int Id { get; set; }
}
