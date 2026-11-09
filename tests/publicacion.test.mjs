import test from 'node:test';
import assert from 'node:assert/strict';
import { FarmaModel } from '../Publicacion/Models/FarmaModel.js';

class Storage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const storage = new Storage();
const session = new Storage();
const model = new FarmaModel(storage, session);

test('el acceso rechaza claves incorrectas y conserva la sesión durante la navegación', async () => {
  await assert.rejects(model.request('/api/state'), e => e.status === 401);
  await assert.rejects(model.request('/api/login', { email: 'admin@farmacontrol.local', password: 'incorrecta' }), e => e.status === 401);
  await model.request('/api/login', { email: 'admin@farmacontrol.local', password: 'Farma2026!' });
  assert.equal((await new FarmaModel(storage, session).request('/api/state')).actor.role, 'Administrador');
  assert.equal([...storage.data.values()].some(s => s.includes('Farma2026!')), false);
});

test('compra venta y anulación conservan saldos e impiden la doble restitución', async () => {
  const initial = await model.request('/api/state');
  const lot = initial.state.lots.find(l => l.id === 1);
  const purchase = await model.request('/api/compras', { supplierId: 1, document: 'PUBLICACION-001', items: [{ lotId: 1, qty: 10, price: 5 }] });
  assert.equal(purchase.state.lots.find(l => l.id === 1).stock, lot.stock + 10);
  const sale = await model.request('/api/ventas', { clientId: 1, type: 'BOLETA', items: [{ lotId: 1, qty: 2, price: 0.01 }] });
  assert.equal(sale.state.sales.find(s => s.id === sale.operationId).total, 17);
  assert.equal(sale.state.lots.find(l => l.id === 1).stock, lot.stock + 8);
  const cancelled = await model.request('/api/ventas/anular', { id: sale.operationId });
  assert.equal(cancelled.state.lots.find(l => l.id === 1).stock, lot.stock + 10);
  await assert.rejects(model.request('/api/ventas/anular', { id: sale.operationId }));
  assert.deepEqual((await model.request('/api/state')).state.lots, cancelled.state.lots);
});

test('una operación rechazada no modifica los registros persistidos', async () => {
  const before = await model.request('/api/state');
  await assert.rejects(model.request('/api/ventas', { clientId: 1, type: 'BOLETA', items: [{ lotId: 1, qty: 999999 }] }));
  assert.deepEqual((await model.request('/api/state')).state, before.state);
});

test('los clientes se conservan al crear otra sesión del modelo', async () => {
  await model.request('/api/clientes', { docType: 'DNI', doc: '80000001', name: 'Cliente de verificación', phone: '' });
  const restored = await new FarmaModel(storage, session).request('/api/state');
  assert.ok(restored.state.clients.some(c => c.doc === '80000001'));
  await assert.rejects(model.request('/api/clientes', { docType: 'DNI', doc: '80000001', name: 'Duplicado' }));
});

test('el perfil de caja no anula ventas y el cierre de sesión impide continuar', async () => {
  await model.request('/api/logout', {});
  await model.request('/api/login', { email: 'caja@farmacontrol.local', password: 'Farma2026!' });
  await assert.rejects(model.request('/api/ventas/anular', { id: 1 }), e => e.status === 403);
  await model.request('/api/logout', {});
  await assert.rejects(model.request('/api/state'), e => e.status === 401);
});

test('los usuarios registrados acceden con su contraseña y respetan el estado activo', async () => {
  await model.request('/api/login', { email: 'admin@farmacontrol.local', password: 'Farma2026!' });
  const result = await model.request('/api/usuarios', { name: 'Usuario de verificación', email: 'verificacion@farmacontrol.local', role: 'Cajero', password: 'Verificacion2026!' });
  const id = result.state.users.find(u => u.email === 'verificacion@farmacontrol.local').id;
  const another = new FarmaModel(storage, new Storage());
  await another.request('/api/login', { email: 'verificacion@farmacontrol.local', password: 'Verificacion2026!' });
  await model.request('/api/usuarios/estado', { id });
  await assert.rejects(another.request('/api/state'), e => e.status === 401);
});
