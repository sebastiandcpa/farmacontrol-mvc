using FarmaControl.Models;
using FarmaControl.Security;
using System.Data;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace FarmaControl.Data;

public class Repository(IConfiguration config, IWebHostEnvironment environment)
{
    readonly string connectionString = config.GetConnectionString("FarmaControl") ?? throw new InvalidOperationException("Falta la conexión FarmaControl.");
    static readonly string[] Roles = ["Administrador", "Cajero", "Almacenero", "Químico farmacéutico"];
    static DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "SA Pacific Standard Time").DateTime);
    async Task<SqlConnection> Open() { var c = new SqlConnection(connectionString); await c.OpenAsync(); return c; }
    public async Task<bool> Connected() { using var c = await Open(); using var q = new SqlCommand("SELECT COUNT(*) FROM dbo.Rol", c); return Convert.ToInt32(await q.ExecuteScalarAsync()) == 4; }
    public async Task Initialize()
    {
        var cs = new SqlConnectionStringBuilder(connectionString);
        var database = cs.InitialCatalog;
        if (database != "FarmaControlAvance80") throw new InvalidOperationException("La inicialización automática solo está habilitada para FarmaControlAvance80.");
        cs.InitialCatalog = "master";
        using var c = new SqlConnection(cs.ConnectionString);
        await c.OpenAsync();
        using var exists = new SqlCommand("SELECT DB_ID(@database)", c);
        exists.Parameters.AddWithValue("@database", database);
        if (await exists.ExecuteScalarAsync() is not DBNull)
        {
            c.ChangeDatabase(database);
            using var table = new SqlCommand("SELECT OBJECT_ID('dbo.Usuario')", c);
            if (await table.ExecuteScalarAsync() is not DBNull) { Console.WriteLine("FarmaControlAvance80 ya está preparada. Se conservan los registros existentes."); return; }
            c.ChangeDatabase("master");
        }
        var script = await File.ReadAllTextAsync(Path.Combine(environment.ContentRootPath, "database", "FarmaControl_SQLServer.sql"));
        foreach (var batch in Regex.Split(script, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(batch)) continue;
            using var command = new SqlCommand(batch, c) { CommandTimeout = 90 }; await command.ExecuteNonQueryAsync();
        }
        var data = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(environment.ContentRootPath, "database", "datos-iniciales.json")))!;
        var referenceDate = DateOnly.Parse(data["referenceDate"]!.GetValue<string>(), CultureInfo.InvariantCulture);
        var displacement = Today.DayNumber - referenceDate.DayNumber;
        foreach (var lot in data["lots"]!.AsArray()) lot!["expiry"] = DateOnly.Parse(lot["expiry"]!.GetValue<string>(), CultureInfo.InvariantCulture).AddDays(displacement).ToString("yyyy-MM-dd");
        foreach (var recipe in data["recipes"]!.AsArray()) foreach (var key in new[] { "issued", "expiry" }) recipe![key] = DateOnly.Parse(recipe[key]!.GetValue<string>(), CultureInfo.InvariantCulture).AddDays(displacement).ToString("yyyy-MM-dd");
        foreach (var purchase in data["purchases"]!.AsArray()) purchase!["date"] = DateTimeOffset.Parse(purchase["date"]!.GetValue<string>(), CultureInfo.InvariantCulture).AddDays(displacement).ToString("O");
        using var tx = c.BeginTransaction();
        async Task Insert(string sql, params (string, object?)[] values) { using var cmd = Command(c, tx, sql, values); await cmd.ExecuteNonQueryAsync(); }
        await Insert("DELETE dbo.Medicamento; DELETE dbo.Categoria;");
        foreach (var group in data["products"]!.AsArray().Select(x => x!["category"]!.GetValue<string>()).Distinct()) await Insert("INSERT dbo.Categoria(nombre) VALUES(@name)", ("name", group));
        foreach (var u in data["users"]!.AsArray()) await Insert("SET IDENTITY_INSERT dbo.Usuario ON; INSERT dbo.Usuario(usuario_id,rol_id,nombres,correo,hash_contrasena,activo) VALUES(@id,@role,@name,@email,@hash,1); SET IDENTITY_INSERT dbo.Usuario OFF;", ("id", V(u!, "id")), ("role", Array.IndexOf(Roles, u!["role"]!.GetValue<string>()) + 1), ("name", V(u!, "name")), ("email", V(u!, "email")), ("hash", Passwords.Hash("Farma2026!")));
        foreach (var x in data["products"]!.AsArray()) await Insert("SET IDENTITY_INSERT dbo.Medicamento ON; INSERT dbo.Medicamento(medicamento_id,categoria_id,sku,nombre,presentacion,precio_venta,requiere_receta) SELECT @id,categoria_id,@sku,@name,@presentation,@price,@rx FROM dbo.Categoria WHERE nombre=@category; SET IDENTITY_INSERT dbo.Medicamento OFF;", ("id", V(x!, "id")), ("sku", V(x!, "sku")), ("name", V(x!, "name")), ("presentation", V(x!, "presentation")), ("price", V(x!, "price")), ("rx", V(x!, "rx")), ("category", V(x!, "category")));
        foreach (var x in data["clients"]!.AsArray()) await Insert("SET IDENTITY_INSERT dbo.Cliente ON; INSERT dbo.Cliente(cliente_id,tipo_documento,numero_documento,nombre_razon_social,telefono) VALUES(@id,@docType,@doc,@name,@phone); SET IDENTITY_INSERT dbo.Cliente OFF;", ("id", V(x!, "id")), ("docType", V(x!, "docType")), ("doc", V(x!, "doc")), ("name", V(x!, "name")), ("phone", V(x!, "phone")));
        foreach (var x in data["suppliers"]!.AsArray()) await Insert("SET IDENTITY_INSERT dbo.Proveedor ON; INSERT dbo.Proveedor(proveedor_id,ruc,razon_social,telefono) VALUES(@id,@ruc,@name,@phone); SET IDENTITY_INSERT dbo.Proveedor OFF;", ("id", V(x!, "id")), ("ruc", V(x!, "ruc")), ("name", V(x!, "name")), ("phone", V(x!, "phone")));
        foreach (var x in data["lots"]!.AsArray()) await Insert("SET IDENTITY_INSERT dbo.Lote ON; INSERT dbo.Lote(lote_id,medicamento_id,codigo_lote,fecha_vencimiento,stock_actual,stock_minimo) VALUES(@id,@product,@code,@expiry,0,@min); SET IDENTITY_INSERT dbo.Lote OFF;", ("id", V(x!, "id")), ("product", V(x!, "productId")), ("code", V(x!, "code")), ("expiry", V(x!, "expiry")), ("min", V(x!, "min")));
        foreach (var x in data["recipes"]!.AsArray()) await Insert("SET IDENTITY_INSERT dbo.Receta ON; INSERT dbo.Receta(receta_id,cliente_id,numero_receta,nombre_prescriptor,fecha_emision,fecha_vencimiento,registrado_por) VALUES(@id,@client,@code,@prescriber,@issued,@expiry,4); SET IDENTITY_INSERT dbo.Receta OFF;", ("id", V(x!, "id")), ("client", V(x!, "clientId")), ("code", V(x!, "code")), ("prescriber", V(x!, "prescriber")), ("issued", V(x!, "issued")), ("expiry", V(x!, "expiry")));
        foreach (var x in data["purchases"]!.AsArray())
        {
            await Insert("SET IDENTITY_INSERT dbo.Compra ON; INSERT dbo.Compra(compra_id,proveedor_id,usuario_id,fecha,numero_documento,total) VALUES(@id,@supplier,@user,@date,@document,@total); SET IDENTITY_INSERT dbo.Compra OFF;", ("id", V(x!, "id")), ("supplier", V(x!, "supplierId")), ("user", V(x!, "userId")), ("date", DateTime.Parse(x!["date"]!.GetValue<string>(), null, DateTimeStyles.RoundtripKind).ToLocalTime()), ("document", V(x!, "document")), ("total", V(x!, "total")));
            foreach (var item in x["items"]!.AsArray()) await Insert("INSERT dbo.DetalleCompra(compra_id,lote_id,cantidad,costo_unitario) VALUES(@purchase,@lot,@qty,@price); UPDATE dbo.Lote SET stock_actual=stock_actual+@qty WHERE lote_id=@lot; INSERT dbo.MovimientoStock(lote_id,usuario_id,compra_id,tipo,cantidad,fecha) SELECT @lot,usuario_id,compra_id,'ENTRADA_COMPRA',@qty,fecha FROM dbo.Compra WHERE compra_id=@purchase;", ("purchase", V(x, "id")), ("lot", V(item!, "lotId")), ("qty", V(item!, "qty")), ("price", V(item!, "price")));
        }
        tx.Commit();
        Console.WriteLine("SQL Server preparado con 13 tablas, 3 procedimientos y datos iniciales. Contraseña inicial de las cuatro cuentas: Farma2026!");
    }
    static object? V(JsonNode node, string property)
    {
        var value = node[property];
        if (value is null) return null;
        var e = JsonSerializer.SerializeToElement(value);
        return e.ValueKind switch { JsonValueKind.Number => e.GetDecimal(), JsonValueKind.True => true, JsonValueKind.False => false, _ => e.GetString() };
    }
    static SqlCommand Command(SqlConnection c, SqlTransaction? tx, string sql, params (string, object?)[] args)
    {
        var cmd = new SqlCommand(sql, c, tx) { CommandTimeout = 30 };
        foreach (var (name, value) in args) cmd.Parameters.AddWithValue("@" + name, value ?? DBNull.Value);
        return cmd;
    }
    async Task<User?> FindUser(string where, object value)
    {
        using var c = await Open(); using var q = Command(c, null, "SELECT u.usuario_id,u.nombres,u.correo,r.nombre,u.activo,u.hash_contrasena FROM dbo.Usuario u JOIN dbo.Rol r ON r.rol_id=u.rol_id WHERE " + where + "=@value", ("value", value));
        using var reader = await q.ExecuteReaderAsync();
        return await reader.ReadAsync() ? new User(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetBoolean(4), reader.GetString(5)) : null;
    }
    public Task<User?> User(int id) => FindUser("u.usuario_id", id);
    public Task<User?> UserByEmail(string email) => FindUser("u.correo", email);
    public async Task<object> State(int actorId, int? operationId = null)
    {
        var actor = await User(actorId) ?? throw new RuleError("Usuario no disponible.", 401);
        using var c = await Open(); using var tx = c.BeginTransaction(IsolationLevel.Serializable);
        var state = new JsonObject { ["version"] = 2, ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O") };
        var queries = new Dictionary<string, string>
        {
            ["products"] = "SELECT m.medicamento_id id,m.sku,m.nombre name,c.nombre category,m.presentacion presentation,m.precio_venta price,m.requiere_receta rx FROM dbo.Medicamento m JOIN dbo.Categoria c ON c.categoria_id=m.categoria_id ORDER BY m.medicamento_id",
            ["lots"] = "SELECT lote_id id,medicamento_id productId,codigo_lote code,CONVERT(char(10),fecha_vencimiento,23) expiry,stock_actual stock,stock_minimo min FROM dbo.Lote ORDER BY lote_id",
            ["clients"] = actor.Role == Roles[2] ? "SELECT cliente_id id,N'Cliente' name FROM dbo.Cliente" : "SELECT cliente_id id,tipo_documento docType,numero_documento doc,nombre_razon_social name,COALESCE(telefono,'') phone FROM dbo.Cliente ORDER BY cliente_id",
            ["suppliers"] = "SELECT proveedor_id id,razon_social name,ruc,COALESCE(telefono,'') phone,activo active FROM dbo.Proveedor ORDER BY proveedor_id",
            ["users"] = actor.Role == Roles[0] ? "SELECT u.usuario_id id,u.nombres name,u.correo email,r.nombre role,u.activo active FROM dbo.Usuario u JOIN dbo.Rol r ON r.rol_id=u.rol_id ORDER BY u.usuario_id" : "SELECT usuario_id id,nombres name FROM dbo.Usuario ORDER BY usuario_id",
            ["recipes"] = actor.Role == Roles[2] ? "SELECT receta_id id FROM dbo.Receta WHERE 1=0" : "SELECT receta_id id,cliente_id clientId,numero_receta code,nombre_prescriptor prescriber,CONVERT(char(10),fecha_emision,23) issued,CONVERT(char(10),fecha_vencimiento,23) expiry,estado status,registrado_por userId FROM dbo.Receta ORDER BY receta_id",
            ["sales"] = "SELECT v.venta_id id,v.cliente_id clientId,v.usuario_id userId,v.receta_id recipeId,CONVERT(varchar(33),v.fecha,126) date,v.tipo_comprobante type,v.numero_comprobante code,v.estado status,v.total,CONVERT(varchar(33),v.anulado_en,126) cancelledAt,v.anulado_por cancelledBy,JSON_QUERY((SELECT d.lote_id lotId,l.medicamento_id productId,m.nombre name,l.codigo_lote lot,d.cantidad qty,d.precio_unitario price FROM dbo.DetalleVenta d JOIN dbo.Lote l ON l.lote_id=d.lote_id JOIN dbo.Medicamento m ON m.medicamento_id=l.medicamento_id WHERE d.venta_id=v.venta_id FOR JSON PATH)) items FROM dbo.Venta v ORDER BY v.venta_id",
            ["purchases"] = "SELECT c.compra_id id,c.proveedor_id supplierId,c.usuario_id userId,CONVERT(varchar(33),c.fecha,126) date,c.numero_documento document,c.total,JSON_QUERY((SELECT d.lote_id lotId,l.medicamento_id productId,m.nombre name,l.codigo_lote lot,d.cantidad qty,d.costo_unitario price FROM dbo.DetalleCompra d JOIN dbo.Lote l ON l.lote_id=d.lote_id JOIN dbo.Medicamento m ON m.medicamento_id=l.medicamento_id WHERE d.compra_id=c.compra_id FOR JSON PATH)) items FROM dbo.Compra c ORDER BY c.compra_id",
            ["movements"] = "SELECT x.movimiento_id id,x.lote_id lotId,x.usuario_id userId,x.tipo type,x.cantidad qty,COALESCE(c.numero_documento,v.numero_comprobante) reference,CONVERT(varchar(33),x.fecha,126) date FROM dbo.MovimientoStock x LEFT JOIN dbo.Compra c ON c.compra_id=x.compra_id LEFT JOIN dbo.Venta v ON v.venta_id=x.venta_id ORDER BY x.movimiento_id"
        };
        foreach (var (key, sql) in queries)
        {
            using var command = new SqlCommand(sql + " FOR JSON PATH", c, tx);
            using var reader = await command.ExecuteReaderAsync(); var text = new System.Text.StringBuilder();
            while (await reader.ReadAsync()) text.Append(reader.GetString(0));
            state[key] = JsonNode.Parse(text.Length == 0 ? "[]" : text.ToString());
        }
        tx.Commit(); return new { actor = actor.Public(), state, operationId };
    }
    static string Text(JsonElement input, string key, int max = 160, bool optional = false)
    {
        var value = input.TryGetProperty(key, out var v) ? v.ToString().Trim() : "";
        if ((!optional && value.Length == 0) || value.Length > max) throw new RuleError($"Completa {key} con un máximo de {max} caracteres.");
        return value;
    }
    static int Number(JsonElement input, string key, int min = 1)
    {
        if (!input.TryGetProperty(key, out var v) || !int.TryParse(v.ToString(), out var n) || n < min || n > 999999) throw new RuleError($"{key}: ingresa un entero válido, mínimo {min}."); return n;
    }
    static decimal Price(JsonElement input, string key)
    {
        if (!input.TryGetProperty(key, out var v) || !decimal.TryParse(v.ToString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var n) || n < 0 || n > 999999) throw new RuleError($"{key}: importe no válido."); return decimal.Round(n, 2, MidpointRounding.AwayFromZero);
    }
    static DateOnly Date(JsonElement input, string key) { if (!DateOnly.TryParseExact(Text(input, key, 10), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)) throw new RuleError("Selecciona una fecha válida."); return date; }
    public async Task<int?> Apply(string action, JsonElement input, User user)
    {
        string[] authorized = action switch
        {
            "sale" or "client" => [Roles[0], Roles[1]],
            "purchase" or "product" or "lot" or "supplier" => [Roles[0], Roles[2]],
            "recipe" => [Roles[3]],
            "cancelSale" or "user" or "userToggle" => [Roles[0]],
            _ => throw new RuleError("Operación no disponible.", 404)
        };
        if (!user.Active || !authorized.Contains(user.Role)) throw new RuleError("Tu usuario no tiene permiso para esta operación.", 403);
        using var c = await Open();
        if (action is "sale" or "purchase")
        {
            if (!input.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array || items.GetArrayLength() is < 1 or > 100) throw new RuleError("Agrega entre 1 y 100 lotes.");
            var table = new DataTable(); table.Columns.Add("lote_id", typeof(int)); table.Columns.Add("cantidad", typeof(int));
            if (action == "purchase") table.Columns.Add("costo_unitario", typeof(decimal));
            var ids = new HashSet<int>();
            foreach (var item in items.EnumerateArray())
            {
                int lot = Number(item, "lotId"), qty = Number(item, "qty");
                if (!ids.Add(lot)) throw new RuleError("No agregues el mismo lote dos veces.");
                if (action == "sale") table.Rows.Add(lot, qty); else table.Rows.Add(lot, qty, Price(item, "price"));
            }
            using var command = new SqlCommand(action == "sale" ? "dbo.sp_RegistrarVenta" : "dbo.sp_RegistrarCompra", c) { CommandType = CommandType.StoredProcedure };
            command.Parameters.AddWithValue("@UsuarioId", user.Id);
            var detail = command.Parameters.AddWithValue("@Items", table); detail.SqlDbType = SqlDbType.Structured; detail.TypeName = action == "sale" ? "dbo.TDetalleVenta" : "dbo.TDetalleCompra";
            if (action == "sale")
            {
                var type = Text(input, "type", 10); if (type is not ("BOLETA" or "FACTURA")) throw new RuleError("Tipo de comprobante inválido.");
                using var seq = new SqlCommand("SELECT NEXT VALUE FOR dbo.SeqComprobante", c); var number = Convert.ToInt64(await seq.ExecuteScalarAsync());
                command.Parameters.AddWithValue("@ClienteId", Number(input, "clientId"));
                command.Parameters.AddWithValue("@TipoComprobante", type);
                command.Parameters.AddWithValue("@NumeroComprobante", (type == "BOLETA" ? "B001-" : "F001-") + number.ToString("D6"));
                var recipe = Text(input, "recipeId", 10, true);
                command.Parameters.AddWithValue("@RecetaId", recipe.Length == 0 ? DBNull.Value : int.TryParse(recipe, out var rid) && rid > 0 ? rid : throw new RuleError("Receta inválida."));
                command.Parameters.Add("@VentaId", SqlDbType.Int).Direction = ParameterDirection.Output;
            }
            else
            {
                command.Parameters.AddWithValue("@ProveedorId", Number(input, "supplierId")); command.Parameters.AddWithValue("@NumeroDocumento", Text(input, "document", 40)); command.Parameters.Add("@CompraId", SqlDbType.Int).Direction = ParameterDirection.Output;
            }
            await command.ExecuteNonQueryAsync(); return Convert.ToInt32(command.Parameters[action == "sale" ? "@VentaId" : "@CompraId"].Value);
        }
        if (action == "cancelSale")
        {
            using var command = Command(c, null, "EXEC dbo.sp_AnularVenta @VentaId=@id,@UsuarioId=@user", ("id", Number(input, "id")), ("user", user.Id)); await command.ExecuteNonQueryAsync(); return null;
        }
        using var tx = c.BeginTransaction(IsolationLevel.Serializable);
        var idValue = Text(input, "id", 10, true);
        var id = idValue.Length == 0 ? 0 : Number(input, "id");
        string sql; (string, object?)[] values;
        if (action == "client")
        {
            var type = Text(input, "docType", 3); var doc = Text(input, "doc", 15);
            if (!new[] { "DNI", "CE", "RUC", "OTR" }.Contains(type) || type == "DNI" && !Regex.IsMatch(doc, @"^\d{8}$") || type == "RUC" && !Regex.IsMatch(doc, @"^\d{11}$")) throw new RuleError("Revisa el tipo y número de documento. DNI: 8 dígitos. RUC: 11 dígitos.");
            values = [("id", id), ("type", type), ("doc", doc), ("name", Text(input, "name")), ("phone", Text(input, "phone", 20, true))];
            sql = id == 0 ? "INSERT dbo.Cliente(tipo_documento,numero_documento,nombre_razon_social,telefono) VALUES(@type,@doc,@name,@phone)" : "UPDATE dbo.Cliente SET tipo_documento=@type,numero_documento=@doc,nombre_razon_social=@name,telefono=@phone WHERE cliente_id=@id";
        }
        else if (action == "product")
        {
            var category = Text(input, "category", 90);
            using var cat = Command(c, tx, "IF NOT EXISTS(SELECT 1 FROM dbo.Categoria WITH(UPDLOCK,HOLDLOCK) WHERE nombre=@name) INSERT dbo.Categoria(nombre) VALUES(@name); SELECT categoria_id FROM dbo.Categoria WHERE nombre=@name", ("name", category));
            var categoryId = Convert.ToInt32(await cat.ExecuteScalarAsync());
            values = [("id", id), ("category", categoryId), ("sku", Text(input, "sku", 30).ToUpperInvariant()), ("name", Text(input, "name")), ("presentation", Text(input, "presentation", 90)), ("price", Price(input, "price")), ("rx", input.TryGetProperty("rx", out var rx) && rx.ValueKind == JsonValueKind.True)];
            sql = id == 0 ? "INSERT dbo.Medicamento(categoria_id,sku,nombre,presentacion,precio_venta,requiere_receta) VALUES(@category,@sku,@name,@presentation,@price,@rx)" : "UPDATE dbo.Medicamento SET categoria_id=@category,sku=@sku,nombre=@name,presentacion=@presentation,precio_venta=@price,requiere_receta=@rx WHERE medicamento_id=@id";
        }
        else if (action == "lot")
        {
            var expiry = Date(input, "expiry"); if (expiry < Today) throw new RuleError("El nuevo lote no puede estar vencido.");
            values = [("product", Number(input, "productId")), ("code", Text(input, "code", 60)), ("expiry", expiry.ToDateTime(TimeOnly.MinValue)), ("min", Number(input, "min", 0))];
            sql = "INSERT dbo.Lote(medicamento_id,codigo_lote,fecha_vencimiento,stock_minimo) VALUES(@product,@code,@expiry,@min)";
        }
        else if (action == "recipe")
        {
            var issued = Date(input, "issued"); var expiry = Date(input, "expiry"); if (issued > Today || expiry < issued || expiry < Today) throw new RuleError("La receta debe estar vigente y sus fechas deben ser coherentes.");
            values = [("client", Number(input, "clientId")), ("code", Text(input, "code", 50)), ("prescriber", Text(input, "prescriber")), ("issued", issued.ToDateTime(TimeOnly.MinValue)), ("expiry", expiry.ToDateTime(TimeOnly.MinValue)), ("user", user.Id)];
            sql = "INSERT dbo.Receta(cliente_id,numero_receta,nombre_prescriptor,fecha_emision,fecha_vencimiento,registrado_por) VALUES(@client,@code,@prescriber,@issued,@expiry,@user)";
        }
        else if (action == "supplier")
        {
            var ruc = Text(input, "ruc", 11); if (!Regex.IsMatch(ruc, @"^\d{11}$")) throw new RuleError("El RUC debe tener 11 dígitos.");
            values = [("ruc", ruc), ("name", Text(input, "name", 180)), ("phone", Text(input, "phone", 20, true))];
            sql = "INSERT dbo.Proveedor(ruc,razon_social,telefono) VALUES(@ruc,@name,@phone)";
        }
        else if (action == "user")
        {
            var role = Text(input, "role", 40); var email = Text(input, "email", 160).ToLowerInvariant(); var password = Text(input, "password", 128);
            if (!Roles.Contains(role) || !Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$") || password.Length < 10) throw new RuleError("Revisa correo, rol y contraseña de al menos 10 caracteres.");
            values = [("role", Array.IndexOf(Roles, role) + 1), ("email", email), ("name", Text(input, "name", 120)), ("hash", Passwords.Hash(password))];
            sql = "INSERT dbo.Usuario(rol_id,nombres,correo,hash_contrasena) VALUES(@role,@name,@email,@hash)";
        }
        else
        {
            if (id == user.Id) throw new RuleError("No puedes desactivar tu propio usuario.");
            values = [("id", id)]; sql = "UPDATE dbo.Usuario SET activo=1-activo WHERE usuario_id=@id";
        }
        using var cmd = Command(c, tx, sql, values); if (await cmd.ExecuteNonQueryAsync() == 0) throw new RuleError("No se encontró el registro.", 404);
        tx.Commit(); return null;
    }
}
