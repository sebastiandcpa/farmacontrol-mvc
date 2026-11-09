# FarmaControl

Sistema web de gestión de ventas, compras e inventario de farmacia, desarrollado con ASP.NET Core MVC, vistas Razor y SQL Server.

## Arquitectura

| Componente | Responsabilidad |
| --- | --- |
| Models | Usuario, modelos de presentación y solicitudes tipadas con validación de datos. |
| Views | Vistas Razor de acceso e inicio y diseño compartido de la aplicación. |
| Controllers | Acceso y operaciones de clientes, inventario, ventas, compras, recetas, proveedores y usuarios. |
| Data | Consultas parametrizadas y ejecución de procedimientos almacenados. |
| Infrastructure | Validación de solicitudes HTTP, conversión de identificadores y tratamiento de errores. |
| Security | Cálculo y verificación de contraseñas mediante PBKDF2. |
| wwwroot | Hojas de estilo, iconos y JavaScript de interacción. |

Razor genera la estructura de las páginas y el formulario de acceso. JavaScript actualiza las tablas y los formularios mediante solicitudes JSON a los controladores. Los modelos validan las solicitudes y el repositorio conserva las reglas de persistencia. SQL Server confirma las operaciones comerciales mediante transacciones.

## Requisitos

- Windows 10 o posterior.
- .NET SDK 10.
- SQL Server Express LocalDB 2019 o posterior.
- Conexión a Internet durante la primera restauración de dependencias.

El proyecto se verificó con .NET SDK 10.0.401 y SQL Server LocalDB 17.

## Instalación y ejecución

1. Descargar y extraer el proyecto.
2. Abrir `INICIAR_FARMACONTROL.cmd`.
3. Esperar la restauración de dependencias, compilación y preparación de la base.
4. Ingresar a `http://localhost:5188` y mantener abierta la ventana del servidor.

El iniciador crea la instancia `FarmaControlAvance80` y una base del mismo nombre. Si la base ya existe, conserva sus registros. También se puede abrir `FarmaControl.sln` en una versión de Visual Studio compatible con .NET 10. La conexión se configura en `appsettings.json`.

## Cuentas de evaluación local

| Rol | Correo | Contraseña inicial |
| --- | --- | --- |
| Administrador | admin@farmacontrol.local | Farma2026! |
| Cajero | caja@farmacontrol.local | Farma2026! |
| Almacenero | almacen@farmacontrol.local | Farma2026! |
| Químico farmacéutico | quimico@farmacontrol.local | Farma2026! |

Las contraseñas se almacenan con PBKDF2 SHA256, sal individual y 210 000 iteraciones. La sesión utiliza una cookie HttpOnly de dos horas. Los registros iniciales y las cuentas corresponden a evaluación local.

## Funcionalidades

- Acceso y autorización por rol.
- Registro, búsqueda y edición de clientes y medicamentos.
- Registro de lotes, vencimientos, mínimos y proveedores.
- Recepción de compras con detalle y actualización de existencias.
- Registro de ventas por lote con precios calculados en el servidor.
- Verificación de stock, vencimientos y referencias de recetas.
- Consulta e impresión de constancias internas.
- Anulación administrativa única y registro de reversos.
- Alertas y reportes por periodo con exportación CSV.
- Registro de usuarios y control de su estado activo.

## Base de datos

`database/FarmaControl_SQLServer.sql` contiene trece tablas, claves, restricciones, índices, dos tipos de tabla, tres procedimientos, tres vistas y una secuencia de comprobantes. `database/datos-iniciales.json` contiene los registros de instalación. Sus fechas se ajustan a la fecha de instalación inicial; los registros existentes se conservan.

Las compras, ventas y anulaciones conservan cabecera, detalle y movimiento de existencias. La base impide saldos negativos, ventas de lotes vencidos y una segunda anulación de la misma venta.

## Verificación

Se ejecutaron 12 pruebas de reglas JavaScript, 23 pruebas de controladores HTTP y 10 pruebas SQL. Los resultados están en `evidencias`.

Con Node.js 20 o posterior:

```powershell
node --test tests/domain.test.mjs
```

Con Python 3 y el servidor iniciado:

```powershell
python tests/pruebas_api.py
```

`database/Pruebas_T01_T10.sql` permite repetir las comprobaciones SQL. Las pruebas HTTP crean registros de verificación y deben ejecutarse en una base de evaluación.

## Alcance

La versión implementa diecisiete de los dieciocho requisitos funcionales priorizados. RF-18 mantiene pendiente la bitácora completa de accesos y cambios administrativos. El cierre comprende aceptación con usuarios reales, recuperación de cuentas, respaldo y restauración verificados y despliegue por HTTPS con privilegios mínimos de base de datos.

Las constancias son documentos internos sin validez tributaria. El sistema no procesa pagos ni emisión SUNAT, no evalúa dosis o autenticidad clínica de recetas y no gestiona devoluciones sanitarias.

## Repositorio y demostración

Repositorio: https://github.com/sebastiandcpa/farmacontrol-mvc

La aplicación requiere un servidor ASP.NET Core y SQL Server. GitHub Pages no proporciona ese entorno. El recorrido de exposición está en `GUIA_EXPOSICION.md`.
