using System.Security.Claims;
using System.Threading.RateLimiting;
using System.Text.Json.Serialization;
using FarmaControl.Data;
using FarmaControl.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

var initialize = args.Contains("--init");
var builder = WebApplication.CreateBuilder(args.Where(a => a != "--init").ToArray());
builder.Services.AddScoped<Repository>();
builder.Services.AddControllersWithViews().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
    o.JsonSerializerOptions.Converters.Add(new NullableIntConverter());
});
builder.Services.Configure<ApiBehaviorOptions>(o => o.InvalidModelStateResponseFactory = c =>
    new BadRequestObjectResult(new { error = "Revisa los campos del formulario.", fields = c.ModelState.Where(x => x.Value!.Errors.Count > 0).Select(x => x.Key).ToArray() }));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "FarmaControl.Session";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromHours(2);
    o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
    o.Events.OnValidatePrincipal = async c =>
    {
        var repo = c.HttpContext.RequestServices.GetRequiredService<Repository>();
        var id = int.Parse(c.Principal!.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await repo.User(id);
        if (user is null || !user.Active || user.Hash != c.Principal!.FindFirstValue("stamp") || user.Role != c.Principal!.FindFirstValue(ClaimTypes.Role)) c.RejectPrincipal();
    };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("login", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();
if (initialize) { using var scope = app.Services.CreateScope(); await scope.ServiceProvider.GetRequiredService<Repository>().Initialize(); return; }

app.UseMiddleware<RequestMiddleware>();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();
