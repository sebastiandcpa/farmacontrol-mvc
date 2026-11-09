
export const VERSION = 1;
export const ROLES = ['Administrador', 'Cajero', 'Almacenero', 'Químico farmacéutico'];
export const money = n => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(n || 0));
export function day(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function offsetDay(n, from = new Date()) { const d = new Date(from); d.setDate(d.getDate() + n); return day(d); }
export function daysUntil(date, today = day()) { return Math.round((new Date(date + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 86400000); }
export const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const id = rows => Math.max(0, ...rows.map(x => x.id)) + 1;
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
function text(value, label, max = 160) {
  const s = String(value ?? '').trim();
  requireThat(s.length > 0 && s.length <= max, `${label}: completa el campo (máximo ${max} caracteres).`);
  return s;
}
function validDate(value, label) {
  const s = text(value, label, 10);
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, `${label}: selecciona una fecha válida.`);
  return s;
}
function number(value, label, min = 0, integer = false) {
  const n = Number(value);
  requireThat(String(value).trim() !== '' && Number.isFinite(n) && n >= min && n <= 999999 && (!integer || Number.isInteger(n)), `${label}: ingresa ${integer ? 'un entero' : 'un número'} válido, mínimo ${min}.`);
  return n;
}
export function lotStatus(lot, today = day()) {
  if (lot.expiry < today) return { label: 'Vencido', tone: 'red', key: 'expired' };
  if (lot.stock === 0) return { label: 'Sin stock', tone: 'gray', key: 'empty' };
  if (daysUntil(lot.expiry, today) <= 30) return { label: 'Por vencer', tone: 'amber', key: 'near' };
  if (lot.stock <= lot.min) return { label: 'Stock bajo', tone: 'amber', key: 'low' };
  return { label: 'Disponible', tone: 'green', key: 'ok' };
}
export function alerts(state, today = day()) {
  return state.lots.filter(l => l.stock <= l.min || (l.stock > 0 && daysUntil(l.expiry, today) <= 30))
    .map(l => ({ ...l, product: state.products.find(p => p.id === l.productId), status: lotStatus(l, today) }))
    .sort((a, b) => ({ expired: 0, empty: 1, near: 2, low: 3 }[a.status.key] ?? 4) - ({ expired: 0, empty: 1, near: 2, low: 3 }[b.status.key] ?? 4));
}
export function allowed(role, action) {
  if (action === 'recipe') return role === ROLES[3];
  if (role === ROLES[0]) return true;
  return ({ sale: [ROLES[1]], client: [ROLES[1]], purchase: [ROLES[2]], product: [ROLES[2]], lot: [ROLES[2]], supplier: [ROLES[2]], recipe: [ROLES[3]], cancelSale: [], user: [], userToggle: [] }[action] || []).includes(role);
}
function itemsOf(state, items, buying) {
  requireThat(Array.isArray(items) && items.length > 0, 'Agrega al menos un medicamento al detalle.');
  const used = new Set();
  return items.map(item => {
    const lot = state.lots.find(l => l.id === Number(item.lotId));
    requireThat(lot, 'El lote seleccionado no existe.');
    const product = state.products.find(p => p.id === lot.productId);
    requireThat(product, 'El medicamento no existe.');
    requireThat(!used.has(lot.id), 'El mismo lote no puede aparecer dos veces.');
    used.add(lot.id);
    const qty = number(item.qty, 'Cantidad', 1, true);
    requireThat(lot.expiry >= day(), buying ? 'No se puede recibir un lote vencido.' : 'No se puede vender un lote vencido.');
    if (!buying) requireThat(lot.stock >= qty, `Stock insuficiente de ${product.name}. Disponible: ${lot.stock}.`);
    return { lotId: lot.id, productId: product.id, name: product.name, lot: lot.code, qty, price: buying ? round(number(item.price, 'Costo unitario')) : product.price };
  });
}
export function applyOperation(previous, action, input, actor) {
  const state = structuredClone(previous);
  const user = state.users.find(u => u.id === Number(actor?.id) && u.active);
  requireThat(user && allowed(user.role, action), 'Este perfil no tiene permiso para realizar la operación.');
  const timestamp = new Date().toISOString();
  const movement = (item, type, reference) => state.movements.push({ id: id(state.movements), lotId: item.lotId, qty: item.qty, type, reference, userId: user.id, date: timestamp });
  if (action === 'sale') {
    const client = state.clients.find(c => c.id === Number(input.clientId));
    requireThat(client, 'Selecciona un cliente registrado.');
    const items = itemsOf(state, input.items, false);
    const recipeId = input.recipeId ? Number(input.recipeId) : null;
    if (recipeId || items.some(i => state.products.find(p => p.id === i.productId).rx)) {
      const recipe = state.recipes.find(r => r.id === recipeId);
      requireThat(recipe && recipe.clientId === client.id && recipe.status === 'VALIDA' && recipe.issued <= day() && recipe.expiry >= day(), 'Selecciona una receta válida, vigente y del mismo cliente.');
    }
    requireThat(['BOLETA', 'FACTURA'].includes(input.type), 'Selecciona un tipo de comprobante válido.');
    if (input.type === 'FACTURA') requireThat(client.docType === 'RUC', 'Para una factura interna, selecciona un cliente con RUC.');
    const saleId = id(state.sales);
    const code = `${input.type === 'FACTURA' ? 'F001' : 'B001'}-${String(saleId + 100).padStart(6, '0')}`;
    state.sales.push({ id: saleId, code, clientId: client.id, userId: user.id, recipeId, type: input.type, status: 'CONFIRMADA', date: timestamp, total: round(items.reduce((s, i) => s + i.qty * i.price, 0)), items });
    for (const item of items) { state.lots.find(l => l.id === item.lotId).stock -= item.qty; movement(item, 'SALIDA_VENTA', code); }
  } else if (action === 'cancelSale') {
    const sale = state.sales.find(s => s.id === Number(input.id));
    requireThat(sale && sale.status === 'CONFIRMADA', 'La venta no existe o ya fue anulada.');
    sale.status = 'ANULADA'; sale.cancelledAt = timestamp; sale.cancelledBy = user.id;
    for (const item of sale.items) { state.lots.find(l => l.id === item.lotId).stock += item.qty; movement(item, 'REVERSO_VENTA', sale.code); }
  } else if (action === 'purchase') {
    const supplier = state.suppliers.find(s => s.id === Number(input.supplierId) && s.active);
    requireThat(supplier, 'Selecciona un proveedor activo.');
    const document = text(input.document, 'Documento', 40);
    requireThat(!state.purchases.some(p => p.supplierId === supplier.id && p.document.toUpperCase() === document.toUpperCase()), 'El proveedor ya tiene una compra con ese documento.');
    const items = itemsOf(state, input.items, true);
    state.purchases.push({ id: id(state.purchases), supplierId: supplier.id, document, userId: user.id, date: timestamp, total: round(items.reduce((s, i) => s + i.qty * i.price, 0)), items });
    for (const item of items) { state.lots.find(l => l.id === item.lotId).stock += item.qty; movement(item, 'ENTRADA_COMPRA', document); }
  } else if (action === 'client') {
    const existing = input.id ? state.clients.find(c => c.id === Number(input.id)) : null;
    requireThat(!input.id || existing, 'El cliente no existe.');
    const docType = String(input.docType);
    const doc = text(input.doc, 'Documento', 15);
    requireThat(['DNI', 'RUC', 'CE', 'OTR'].includes(docType), 'Tipo de documento no válido.');
    if (docType === 'DNI') requireThat(/^\d{8}$/.test(doc), 'El DNI debe tener 8 dígitos.');
    if (docType === 'RUC') requireThat(/^\d{11}$/.test(doc), 'El RUC debe tener 11 dígitos.');
    requireThat(!state.clients.some(c => c.id !== existing?.id && c.docType === docType && c.doc === doc), 'Ya existe un cliente con ese documento.');
    const record = { id: existing?.id || id(state.clients), docType, doc, name: text(input.name, 'Nombre'), phone: String(input.phone || '').trim().slice(0, 20) };
    if (existing) Object.assign(existing, record); else state.clients.push(record);
  } else if (action === 'product') {
    const existing = input.id ? state.products.find(p => p.id === Number(input.id)) : null;
    requireThat(!input.id || existing, 'El medicamento no existe.');
    const sku = text(input.sku, 'Código', 30).toUpperCase();
    requireThat(!state.products.some(p => p.id !== existing?.id && p.sku === sku), 'Ya existe un medicamento con ese código.');
    const record = { id: existing?.id || id(state.products), sku, name: text(input.name, 'Nombre'), category: text(input.category, 'Categoría', 90), presentation: text(input.presentation, 'Presentación', 90), price: round(number(input.price, 'Precio')), rx: Boolean(input.rx) };
    if (existing) Object.assign(existing, record); else state.products.push(record);
  } else if (action === 'lot') {
    const productId = Number(input.productId);
    requireThat(state.products.some(p => p.id === productId), 'Selecciona un medicamento.');
    const code = text(input.code, 'Código de lote', 60);
    requireThat(!state.lots.some(l => l.productId === productId && l.code.toUpperCase() === code.toUpperCase()), 'Ese código de lote ya existe para este medicamento.');
    const expiry = validDate(input.expiry, 'Vencimiento');
    requireThat(expiry >= day(), 'El nuevo lote no puede estar vencido.');
    state.lots.push({ id: id(state.lots), productId, code, expiry, stock: 0, min: number(input.min, 'Stock mínimo', 0, true) });
  } else if (action === 'recipe') {
    const clientId = Number(input.clientId);
    requireThat(state.clients.some(c => c.id === clientId), 'Selecciona un cliente.');
    const code = text(input.code, 'Número de receta', 50);
    requireThat(!state.recipes.some(r => r.code.toUpperCase() === code.toUpperCase()), 'Ya existe una receta con ese número.');
    const issued = validDate(input.issued, 'Emisión'), expiry = validDate(input.expiry, 'Vencimiento');
    requireThat(issued <= day() && expiry >= issued, 'Revisa las fechas de emisión y vencimiento.');
    state.recipes.push({ id: id(state.recipes), clientId, code, prescriber: text(input.prescriber, 'Prescriptor'), issued, expiry, status: 'VALIDA', userId: user.id });
  } else if (action === 'supplier') {
    const ruc = text(input.ruc, 'RUC', 11);
    requireThat(/^\d{11}$/.test(ruc), 'El RUC debe tener 11 dígitos.');
    requireThat(!state.suppliers.some(s => s.ruc === ruc), 'Ya existe un proveedor con ese RUC.');
    state.suppliers.push({ id: id(state.suppliers), name: text(input.name, 'Razón social', 180), ruc, phone: String(input.phone || '').trim().slice(0, 20), active: true });
  } else if (action === 'user') {
    const email = text(input.email, 'Correo', 160).toLowerCase();
    requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Ingresa un correo válido.');
    requireThat(!state.users.some(u => u.email.toLowerCase() === email), 'El correo ya está registrado.');
    requireThat(ROLES.includes(input.role), 'Selecciona un perfil válido.');
    state.users.push({ id: id(state.users), name: text(input.name, 'Nombre', 120), email, role: input.role, active: true });
  } else if (action === 'userToggle') {
    const target = state.users.find(u => u.id === Number(input.id));
    requireThat(target && target.id !== user.id, 'No puedes desactivar tu propio perfil.');
    target.active = !target.active;
  } else throw new Error('Operación no disponible.');
  state.updatedAt = timestamp;
  return state;
}
export function createSeed() {
  const state = {
    version: VERSION, updatedAt: new Date().toISOString(),
    products: [
      { id: 1, sku: 'MED-001', name: 'Paracetamol 500 mg', category: 'Analgésicos', presentation: 'Caja x 20 tabletas', price: 8.5, rx: false },
      { id: 2, sku: 'MED-002', name: 'Cetirizina 10 mg', category: 'Antialérgicos', presentation: 'Caja x 10 tabletas', price: 12.9, rx: false },
      { id: 3, sku: 'MED-003', name: 'Alcohol en gel 250 ml', category: 'Cuidado personal', presentation: 'Frasco 250 ml', price: 9.9, rx: false },
      { id: 4, sku: 'MED-004', name: 'Amoxicilina 500 mg', category: 'Antibióticos', presentation: 'Caja x 21 cápsulas', price: 21.5, rx: true },
      { id: 5, sku: 'MED-005', name: 'Suero fisiológico 500 ml', category: 'Cuidado personal', presentation: 'Frasco 500 ml', price: 7.2, rx: false },
      { id: 6, sku: 'MED-006', name: 'Omeprazol 20 mg', category: 'Gastrointestinal', presentation: 'Caja x 14 cápsulas', price: 16.9, rx: false },
      { id: 7, sku: 'MED-007', name: 'Ibuprofeno 400 mg', category: 'Analgésicos', presentation: 'Caja x 10 tabletas', price: 9.5, rx: false },
      { id: 8, sku: 'MED-008', name: 'Vitamina C 1 g', category: 'Vitaminas', presentation: 'Tubo x 10 tabletas', price: 18.9, rx: false }
    ],
    lots: [
      { id: 1, productId: 1, code: 'P-2401', expiry: offsetDay(360), stock: 0, min: 15 },
      { id: 2, productId: 2, code: 'C-1822', expiry: offsetDay(240), stock: 0, min: 10 },
      { id: 3, productId: 3, code: 'AG-830', expiry: offsetDay(180), stock: 0, min: 12 },
      { id: 4, productId: 4, code: 'AM-705', expiry: offsetDay(20), stock: 0, min: 10 },
      { id: 5, productId: 5, code: 'SF-401', expiry: offsetDay(270), stock: 0, min: 12 },
      { id: 6, productId: 6, code: 'OM-320', expiry: offsetDay(390), stock: 0, min: 10 },
      { id: 7, productId: 7, code: 'IB-104', expiry: offsetDay(150), stock: 0, min: 10 },
      { id: 8, productId: 8, code: 'VC-509', expiry: offsetDay(300), stock: 0, min: 10 },
      { id: 9, productId: 1, code: 'P-ANTERIOR', expiry: offsetDay(-5), stock: 12, min: 5 }
    ],
    clients: [
      { id: 1, docType: 'DNI', doc: '12345678', name: 'María Torres', phone: '999111222' },
      { id: 2, docType: 'DNI', doc: '45678912', name: 'Luis Paredes', phone: '988333444' },
      { id: 3, docType: 'DNI', doc: '78912345', name: 'Ana Rodríguez', phone: '977555666' },
      { id: 4, docType: 'DNI', doc: '32165498', name: 'Pedro Castillo', phone: '966222333' },
      { id: 5, docType: 'RUC', doc: '20123456789', name: 'Centro Médico Los Olivos', phone: '015550100' },
      { id: 6, docType: 'DNI', doc: '65498712', name: 'Sofía Vargas', phone: '955888777' }
    ],
    suppliers: [
      { id: 1, name: 'Distribuidora Salud Perú', ruc: '20111111111', phone: '015550201', active: true },
      { id: 2, name: 'Logística Médica Andina', ruc: '20222222222', phone: '015550202', active: true },
      { id: 3, name: 'Laboratorios Vida Sana', ruc: '20333333333', phone: '015550203', active: true }
    ],
    users: [
      { id: 1, name: 'Lucía Méndez', email: 'admin@farmacontrol.local', role: ROLES[0], active: true },
      { id: 2, name: 'Carlos Ruiz', email: 'caja@farmacontrol.local', role: ROLES[1], active: true },
      { id: 3, name: 'Elena Rojas', email: 'almacen@farmacontrol.local', role: ROLES[2], active: true },
      { id: 4, name: 'Andrés Salazar', email: 'quimico@farmacontrol.local', role: ROLES[3], active: true }
    ],
    recipes: [
      { id: 1, clientId: 1, code: 'REC-00041', prescriber: 'Profesional A', issued: offsetDay(-3), expiry: offsetDay(30), status: 'VALIDA', userId: 4 },
      { id: 2, clientId: 2, code: 'REC-00042', prescriber: 'Profesional B', issued: offsetDay(-2), expiry: offsetDay(25), status: 'VALIDA', userId: 4 },
      { id: 3, clientId: 3, code: 'REC-00038', prescriber: 'Profesional C', issued: offsetDay(-40), expiry: offsetDay(-10), status: 'VALIDA', userId: 4 }
    ],
    sales: [], purchases: [], movements: []
  };
  const quantities = [90, 9, 62, 36, 8, 41, 0, 28];
  for (let i = 0; i < 8; i++) {
    state.lots[i].stock = quantities[i];
    if (quantities[i]) {
      const item = { lotId: i + 1, productId: i + 1, name: state.products[i].name, lot: state.lots[i].code, qty: quantities[i], price: round(state.products[i].price * .6) };
      const document = `FC-${String(i + 1).padStart(4, '0')}`;
      const date = offsetDay(-15) + 'T15:00:00.000Z';
      state.purchases.push({ id: id(state.purchases), supplierId: i % 3 + 1, document, userId: 3, date, total: round(item.qty * item.price), items: [item] });
      state.movements.push({ id: id(state.movements), lotId: item.lotId, qty: item.qty, type: 'ENTRADA_COMPRA', reference: document, userId: 3, date });
    }
  }

  state.openingBalances = [{ lotId: 9, qty: 12 }];
  for (let i = 0; i < 14; i++) {
    const productId = [1, 3, 6, 8][i % 4], lot = state.lots.find(l => l.productId === productId), product = state.products.find(p => p.id === productId);
    const qty = i % 3 + 1, saleId = id(state.sales), code = `B001-${String(100 + saleId).padStart(6, '0')}`;
    const date = offsetDay(-6 + Math.floor(i / 2)) + `T${i % 2 ? '19' : '15'}:30:00.000Z`;
    const item = { lotId: lot.id, productId, name: product.name, lot: lot.code, qty, price: product.price };
    lot.stock -= qty;
    state.sales.push({ id: saleId, code, clientId: i % 6 + 1, userId: 2, recipeId: null, type: 'BOLETA', status: 'CONFIRMADA', date, total: round(qty * product.price), items: [item] });
    state.movements.push({ id: id(state.movements), lotId: lot.id, qty, type: 'SALIDA_VENTA', reference: code, userId: 2, date });
  }
  return state;
}
