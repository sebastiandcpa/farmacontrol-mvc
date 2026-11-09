import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, applyOperation, alerts, lotStatus, day, offsetDay } from '../wwwroot/domain.js';
const admin={id:1};
const sale=(state,extra={})=>applyOperation(state,'sale',{clientId:1,type:'BOLETA',items:[{lotId:1,qty:2}],...extra},admin);
test('venta descuenta stock y registra detalle, total y movimiento sin mutar el estado anterior',()=>{
  const state=createSeed(),before=state.lots[0].stock,next=sale(state);
  assert.equal(state.lots[0].stock,before);assert.equal(next.lots[0].stock,before-2);
  assert.equal(next.sales.at(-1).total,17);assert.equal(next.movements.at(-1).type,'SALIDA_VENTA');
});
test('cantidad excesiva y líneas repetidas se rechazan sin cambios parciales',()=>{
  const state=createSeed(),snapshot=JSON.stringify(state);
  assert.throws(()=>sale(state,{items:[{lotId:1,qty:99999}]}),/Stock insuficiente/);
  assert.throws(()=>sale(state,{items:[{lotId:1,qty:1},{lotId:1,qty:1}]}),/dos veces/);
  assert.equal(JSON.stringify(state),snapshot);
});
test('un lote vencido nunca puede venderse',()=>assert.throws(()=>sale(createSeed(),{items:[{lotId:9,qty:1}]}),/vencido/));
test('medicamento con receta exige referencia válida del mismo cliente',()=>{
  const state=createSeed(),items=[{lotId:4,qty:1}];
  assert.throws(()=>sale(state,{items}),/receta válida/);
  assert.throws(()=>sale(state,{items,recipeId:2}),/mismo cliente/);
  assert.throws(()=>sale(state,{items,clientId:3,recipeId:3}),/receta válida/);
  assert.equal(sale(state,{items,recipeId:1}).sales.at(-1).total,21.5);
});
test('una compra aumenta stock y conserva trazabilidad; documento duplicado se rechaza',()=>{
  const state=createSeed(),payload={supplierId:1,document:'PRUEBA-1',items:[{lotId:1,qty:10,price:5}]};
  const next=applyOperation(state,'purchase',payload,admin);
  assert.equal(next.lots[0].stock,state.lots[0].stock+10);assert.equal(next.purchases.at(-1).total,50);
  assert.equal(next.movements.at(-1).type,'ENTRADA_COMPRA');
  assert.throws(()=>applyOperation(next,'purchase',payload,admin),/ese documento/);
});
test('anulación repone stock una sola vez y conserva venta',()=>{
  const initial=createSeed(),sold=sale(initial),saleId=sold.sales.at(-1).id;
  const cancelled=applyOperation(sold,'cancelSale',{id:saleId},admin);
  assert.equal(cancelled.lots[0].stock,initial.lots[0].stock);assert.equal(cancelled.sales.at(-1).status,'ANULADA');
  assert.equal(cancelled.movements.at(-1).type,'REVERSO_VENTA');
  assert.throws(()=>applyOperation(cancelled,'cancelSale',{id:saleId},admin),/ya fue anulada/);
});
test('cliente duplicado y DNI inválido se rechazan; edición conserva referencias',()=>{
  const state=createSeed();
  assert.throws(()=>applyOperation(state,'client',{docType:'DNI',doc:'12345678',name:'Duplicado'},admin),/Ya existe/);
  assert.throws(()=>applyOperation(state,'client',{docType:'DNI',doc:'123',name:'Inválido'},admin),/8 dígitos/);
  const next=applyOperation(state,'client',{id:1,docType:'DNI',doc:'12345678',name:'María editada'},admin);
  assert.equal(next.clients[0].name,'María editada');assert.equal(next.clients.length,state.clients.length);
});
test('perfil de caja no puede comprar ni anular; perfil inactivo no opera',()=>{
  const state=createSeed();
  assert.throws(()=>applyOperation(state,'purchase',{}, {id:2}),/permiso/);
  assert.throws(()=>applyOperation(state,'cancelSale',{id:1},{id:2}),/permiso/);
  state.users[1].active=false;assert.throws(()=>applyOperation(state,'sale',{}, {id:2}),/permiso/);
});
test('nuevo lote inicia en cero y no admite fechas pasadas o códigos repetidos',()=>{
  const state=createSeed();
  const next=applyOperation(state,'lot',{productId:1,code:'NUEVO',expiry:offsetDay(180),min:5},admin);
  assert.equal(next.lots.at(-1).stock,0);
  assert.throws(()=>applyOperation(state,'lot',{productId:1,code:'X',expiry:offsetDay(-1),min:5},admin),/vencido/);
  assert.throws(()=>applyOperation(state,'lot',{productId:1,code:'P-2401',expiry:offsetDay(10),min:5},admin),/ya existe/);
});
test('alertas incluyen agotados, próximos a vencer y vencidos, con fecha inclusiva',()=>{
  const state=createSeed(),list=alerts(state);
  assert.ok(list.some(l=>l.status.key==='empty'));assert.ok(list.some(l=>l.status.key==='expired'));assert.ok(list.some(l=>l.status.key==='near'));
  assert.equal(lotStatus({stock:10,min:5,expiry:day()}).key,'near');
});
test('existencias coinciden con ingresos menos salidas más reversiones',()=>{
  const initial=createSeed(),sold=sale(initial),next=applyOperation(sold,'cancelSale',{id:sold.sales.at(-1).id},admin);
  for(const lot of next.lots){
    const opening=next.openingBalances.filter(x=>x.lotId===lot.id).reduce((s,x)=>s+x.qty,0);
    const balance=next.movements.filter(m=>m.lotId===lot.id).reduce((s,m)=>s+(m.type==='SALIDA_VENTA'?-m.qty:m.qty),opening);
    assert.equal(lot.stock,balance);
  }
});
test('factura de muestra requiere cliente con RUC y cantidades enteras',()=>{
  assert.throws(()=>sale(createSeed(),{type:'FACTURA'}),/RUC/);
  assert.throws(()=>sale(createSeed(),{items:[{lotId:1,qty:1.5}]}),/entero/);
  assert.equal(sale(createSeed(),{type:'FACTURA',clientId:5}).sales.at(-1).type,'FACTURA');
});
