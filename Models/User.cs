namespace FarmaControl.Models;

public record User(int Id, string Name, string Email, string Role, bool Active, string Hash)
{
    public object Public() => new { id = Id, name = Name, email = Email, role = Role, active = Active };
}
