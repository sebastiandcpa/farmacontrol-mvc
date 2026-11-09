SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE FarmaControlAvance80;
GO
SET NOCOUNT ON;
DECLARE @base int=(SELECT stock_actual FROM dbo.Lote WHERE lote_id=1),@venta int;
BEGIN TRAN;
DECLARE @i dbo.TDetalleVenta;
INSERT @i VALUES(1,2);
EXEC dbo.sp_RegistrarVenta 1,1,NULL,'BOLETA','SQL80-T01',@i,@venta OUTPUT;
IF (SELECT stock_actual FROM dbo.Lote WHERE lote_id=1)<>@base-2 THROW 51001,'T01: stock incorrecto',1;
IF NOT EXISTS(SELECT 1 FROM dbo.DetalleVenta WHERE venta_id=@venta AND cantidad=2) THROW 51001,'T01: detalle ausente',1;
IF NOT EXISTS(SELECT 1 FROM dbo.MovimientoStock WHERE venta_id=@venta AND tipo='SALIDA_VENTA') THROW 51001,'T01: movimiento ausente',1;
ROLLBACK;
PRINT 'T01|Aprobado|Venta, detalle y salida confirmados. Stock disminuye 2 dentro de la transaccion de prueba.';
GO
DECLARE @base int=(SELECT stock_actual FROM dbo.Lote WHERE lote_id=1),@venta int,@error int=0;
DECLARE @i dbo.TDetalleVenta;
INSERT @i VALUES(1,999999);
BEGIN TRY
    EXEC dbo.sp_RegistrarVenta 1,1,NULL,'BOLETA','SQL80-T02',@i,@venta OUTPUT;
END TRY BEGIN CATCH SET @error=ERROR_NUMBER(); END CATCH;
IF @error<>50016 OR (SELECT stock_actual FROM dbo.Lote WHERE lote_id=1)<>@base THROW 51002,'T02: validacion incorrecta',1;
PRINT 'T02|Aprobado|Error 50016. Stock insuficiente rechazado y saldo conservado.';
GO
DECLARE @venta int,@error int=0;
DECLARE @i dbo.TDetalleVenta;
INSERT @i VALUES(9,1);
BEGIN TRY
    BEGIN TRAN;
    UPDATE dbo.Lote SET stock_actual=3 WHERE lote_id=9;
    EXEC dbo.sp_RegistrarVenta 1,1,NULL,'BOLETA','SQL80-T03',@i,@venta OUTPUT;
    IF @@TRANCOUNT>0 ROLLBACK;
END TRY BEGIN CATCH SET @error=ERROR_NUMBER(); IF @@TRANCOUNT>0 ROLLBACK; END CATCH;
IF @error<>50016 THROW 51003,'T03: lote vencido aceptado',1;
PRINT 'T03|Aprobado|Error 50016. Lote vencido rechazado aun con stock positivo.';
GO
DECLARE @venta int,@error int=0;
DECLARE @i dbo.TDetalleVenta;
INSERT @i VALUES(4,1);
BEGIN TRY EXEC dbo.sp_RegistrarVenta 1,1,NULL,'BOLETA','SQL80-T04',@i,@venta OUTPUT;
END TRY BEGIN CATCH SET @error=ERROR_NUMBER(); END CATCH;
IF @error<>50018 THROW 51004,'T04: receta ausente aceptada',1;
PRINT 'T04|Aprobado|Error 50018. Medicamento que requiere receta no se vende sin referencia.';
GO
DECLARE @venta int,@error1 int=0,@error2 int=0;
DECLARE @i dbo.TDetalleVenta;
INSERT @i VALUES(4,1);
BEGIN TRY EXEC dbo.sp_RegistrarVenta 1,1,2,'BOLETA','SQL80-T05A',@i,@venta OUTPUT;
END TRY BEGIN CATCH SET @error1=ERROR_NUMBER(); END CATCH;
BEGIN TRY EXEC dbo.sp_RegistrarVenta 3,1,3,'BOLETA','SQL80-T05B',@i,@venta OUTPUT;
END TRY BEGIN CATCH SET @error2=ERROR_NUMBER(); END CATCH;
IF @error1<>50017 OR @error2<>50017 THROW 51005,'T05: referencia incorrecta aceptada',1;
PRINT 'T05|Aprobado|Error 50017 en receta de otro cliente y en receta vencida.';
GO
DECLARE @base int=(SELECT stock_actual FROM dbo.Lote WHERE lote_id=1),@compra int;
DECLARE @i dbo.TDetalleCompra;
INSERT @i VALUES(1,10,5);
BEGIN TRAN;
EXEC dbo.sp_RegistrarCompra 1,1,'SQL80-T06',@i,@compra OUTPUT;
IF (SELECT stock_actual FROM dbo.Lote WHERE lote_id=1)<>@base+10 THROW 51006,'T06: saldo incorrecto',1;
IF NOT EXISTS(SELECT 1 FROM dbo.MovimientoStock WHERE compra_id=@compra AND tipo='ENTRADA_COMPRA') THROW 51006,'T06: entrada ausente',1;
IF (SELECT total FROM dbo.Compra WHERE compra_id=@compra)<>50 THROW 51006,'T06: importe incorrecto',1;
ROLLBACK;
PRINT 'T06|Aprobado|Compra de 10 unidades, total 50.00 y entrada de inventario verificados.';
GO
DECLARE @venta int,@error int=0,@base int=(SELECT stock_actual FROM dbo.Lote WHERE lote_id=1);
DECLARE @i dbo.TDetalleVenta;
INSERT @i VALUES(1,1);
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_RegistrarVenta 1,1,NULL,'BOLETA','SQL80-T07',@i,@venta OUTPUT;
    EXEC dbo.sp_RegistrarVenta 1,1,NULL,'BOLETA','SQL80-T07',@i,@venta OUTPUT;
    IF @@TRANCOUNT>0 ROLLBACK;
END TRY BEGIN CATCH SET @error=ERROR_NUMBER(); IF @@TRANCOUNT>0 ROLLBACK; END CATCH;
IF @error NOT IN(2601,2627) OR (SELECT stock_actual FROM dbo.Lote WHERE lote_id=1)<>@base THROW 51007,'T07: duplicidad aceptada o saldo alterado',1;
PRINT 'T07|Aprobado|Restriccion UNIQUE rechaza comprobante repetido. Transaccion de prueba revertida.';
GO
DECLARE @venta int,@base int=(SELECT stock_actual FROM dbo.Lote WHERE lote_id=1);
DECLARE @i dbo.TDetalleVenta;
INSERT @i VALUES(1,2);
BEGIN TRAN;
EXEC dbo.sp_RegistrarVenta 1,1,NULL,'BOLETA','SQL80-T08',@i,@venta OUTPUT;
EXEC dbo.sp_AnularVenta @venta,1;
IF (SELECT stock_actual FROM dbo.Lote WHERE lote_id=1)<>@base THROW 51008,'T08: saldo no restituido',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Venta WHERE venta_id=@venta AND estado='ANULADA' AND anulado_por=1 AND anulado_en IS NOT NULL) THROW 51008,'T08: auditoria de anulacion incompleta',1;
IF NOT EXISTS(SELECT 1 FROM dbo.MovimientoStock WHERE venta_id=@venta AND tipo='REVERSO_VENTA') THROW 51008,'T08: reverso ausente',1;
ROLLBACK;
PRINT 'T08|Aprobado|Saldo restituido, venta anulada y reverso con responsable y fecha.';
GO
DECLARE @venta int,@error int=0,@base int=(SELECT stock_actual FROM dbo.Lote WHERE lote_id=1);
DECLARE @i dbo.TDetalleVenta;
INSERT @i VALUES(1,2);
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_RegistrarVenta 1,1,NULL,'BOLETA','SQL80-T09',@i,@venta OUTPUT;
    EXEC dbo.sp_AnularVenta @venta,1;
    EXEC dbo.sp_AnularVenta @venta,1;
    IF @@TRANCOUNT>0 ROLLBACK;
END TRY BEGIN CATCH SET @error=ERROR_NUMBER(); IF @@TRANCOUNT>0 ROLLBACK; END CATCH;
IF @error<>50021 OR (SELECT stock_actual FROM dbo.Lote WHERE lote_id=1)<>@base THROW 51009,'T09: doble reverso o stock incorrecto',1;
PRINT 'T09|Aprobado|Error 50021. Segunda anulacion rechazada sin duplicar existencias.';
GO
IF NOT EXISTS(SELECT 1 FROM dbo.vw_AlertasLote WHERE lote_id=4 AND alerta='POR_VENCER') THROW 51010,'T10: proximo vencimiento ausente',1;
IF NOT EXISTS(SELECT 1 FROM dbo.vw_AlertasLote WHERE lote_id=7 AND alerta='STOCK_BAJO' AND stock_actual=0) THROW 51010,'T10: agotado ausente',1;
IF NOT EXISTS(SELECT 1 FROM dbo.vw_AlertasLote WHERE lote_id=9 AND alerta='VENCIDO') THROW 51010,'T10: vencido ausente',1;
PRINT 'T10|Aprobado|Vista SQL devuelve lote proximo a vencer, agotado y vencido.';
GO
