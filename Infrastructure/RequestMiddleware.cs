using FarmaControl.Models;
using Microsoft.Data.SqlClient;

namespace FarmaControl.Infrastructure;

public sealed class RequestMiddleware(RequestDelegate next, ILogger<RequestMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["Referrer-Policy"] = "same-origin";
        context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.Headers.CacheControl = "no-store";
            if (context.Request.Method == "POST" && (context.Request.Headers["X-Farma-Request"] != "1" || !context.Request.HasJsonContentType()))
            {
                context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { error = "Solicitud no permitida." }); return;
            }
            if (context.Request.Headers.TryGetValue("Origin", out var origin) && origin.ToString() != $"{context.Request.Scheme}://{context.Request.Host}")
            {
                context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { error = "Origen no permitido." }); return;
            }
        }
        try { await next(context); }
        catch (RuleError e) { context.Response.StatusCode = e.Status; await context.Response.WriteAsJsonAsync(new { error = e.Message }); }
        catch (SqlException e)
        {
            context.Response.StatusCode = e.Number is 2601 or 2627 ? 409 : e.Number >= 50000 || e.Number == 547 ? 400 : 503;
            var message = e.Number is 2601 or 2627 ? "Ya existe un registro con ese documento o código." : e.Number >= 50000 ? e.Message : e.Number == 547 ? "La operación incumple una relación o restricción de datos." : "No se pudo acceder a SQL Server. Revisa la conexión e intenta nuevamente.";
            logger.LogWarning("SQL {Number}: {Message}", e.Number, e.Message);
            await context.Response.WriteAsJsonAsync(new { error = message });
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error de operación");
            context.Response.StatusCode = 500; await context.Response.WriteAsJsonAsync(new { error = "No se pudo completar la operación." });
        }
    }
}
