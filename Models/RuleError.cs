namespace FarmaControl.Models;

public class RuleError(string message, int status = 400) : Exception(message) { public int Status { get; } = status; }
