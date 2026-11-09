using System.Security.Claims;
using FarmaControl.Models;
using Microsoft.AspNetCore.Mvc;

namespace FarmaControl.Controllers;

public sealed class HomeController : Controller
{
    [HttpGet("/")]
    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated != true)
            return View("~/Views/Cuenta/Acceso.cshtml", new LoginViewModel());
        return View(new ApplicationViewModel("FarmaControl", User.Identity.Name ?? "", User.FindFirstValue(ClaimTypes.Role) ?? ""));
    }
}
