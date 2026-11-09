# Demostración de FarmaControl

## Preparación

Ejecutar `INICIAR_FARMACONTROL.cmd` y abrir `http://localhost:5188`. El equipo requiere Windows, .NET SDK 10 y SQL Server LocalDB. Mantener el servidor activo durante la exposición.

## Arquitectura

FarmaControl registra compras y ventas y controla existencias por lote. MVC separa los modelos de datos y validación, las vistas Razor y los controladores de cada módulo. La carpeta Data concentra el acceso a SQL Server.

La solución puede abrirse en Visual Studio para identificar Models, Views, Controllers y Data. Los recursos de interacción están en wwwroot.

## Recorrido funcional

1. Ingresar como administrador y presentar las funciones de cada rol.
2. Abrir Inventario, localizar Paracetamol 500 mg y registrar el saldo inicial del lote P-2401.
3. Abrir Compras y recibir diez unidades a S/ 5,00 por unidad con un documento nuevo. Comprobar el incremento de diez unidades.
4. Abrir Ventas y registrar dos unidades para un cliente existente. El precio inicial es S/ 8,50 y el total es S/ 17,00.
5. Revisar la constancia y comprobar la disminución de dos unidades.
6. Anular la venta como administrador. Verificar el historial y la restitución de las unidades una sola vez.
7. Presentar las alertas de inventario y consultar un periodo en Reportes.
8. Cerrar la sesión e ingresar como químico farmacéutico para mostrar el registro de referencias de recetas y sus fechas de vigencia.

## Resultados

La versión aprobó 45 pruebas de reglas, controladores HTTP y SQL. Implementa diecisiete requisitos funcionales completos y uno parcial. Quedan pendientes la auditoría completa de accesos, la aceptación con personal de farmacia y el despliegue público del backend.

La exposición debe mostrar las operaciones y su efecto en las existencias. Las diapositivas acompañan la ejecución del sistema.
