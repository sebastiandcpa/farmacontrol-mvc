namespace FarmaControl.Security;

public static class Passwords
{
    public static string Hash(string password)
    {
        var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        var hash = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(password, salt, 210000, System.Security.Cryptography.HashAlgorithmName.SHA256, 32);
        return $"pbkdf2$210000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }
    public static bool Verify(string password, string encoded)
    {
        try
        {
            var parts = encoded.Split('$');
            if (parts.Length != 4 || parts[0] != "pbkdf2") return false;
            var hash = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(password, Convert.FromBase64String(parts[2]), int.Parse(parts[1]), System.Security.Cryptography.HashAlgorithmName.SHA256, 32);
            return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(hash, Convert.FromBase64String(parts[3]));
        }
        catch { return false; }
    }
}
