using System.Security.Claims;
using FarmaControl.Data;
using FarmaControl.Models;
using FarmaControl.Models.Requests;
using FarmaControl.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FarmaControl.Controllers;

[ApiController]
public sealed class CuentaController(Repository repository) : ControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("/api/login")]
    public async Task<IActionResult> Ingresar(LoginRequest input)
    {
        var user = await repository.UserByEmail(input.Email.Trim().ToLowerInvariant());
        if (user is null || !user.Active || !Passwords.Verify(input.Password, user.Hash))
            throw new RuleError("Correo o contraseña incorrectos.", 401);
        var claims = new[] {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("stamp", user.Hash)
        };
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
        return Ok(new { actor = user.Public() });
    }

    [HttpPost("/api/logout")]
    public async Task<IActionResult> Salir()
    {
        await HttpContext.SignOutAsync();
        return Ok(new { ok = true });
    }
}
