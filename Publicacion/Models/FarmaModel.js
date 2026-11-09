import { applyOperation, createSeed, day } from '../domain.js';

const DATA_KEY = 'farmacontrol.publicacion.v1';
const SESSION_KEY = 'farmacontrol.publicacion.sesion';
const ROUTES = {
  clientes: 'client', medicamentos: 'product', lotes: 'lot', ventas: 'sale',
  'ventas/anular': 'cancelSale', compras: 'purchase', recetas: 'recipe',
  proveedores: 'supplier', usuarios: 'user', 'usuarios/estado': 'userToggle'
};

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function passwordRecord(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, material, 256);
  return { salt: Array.from(salt), hash: Array.from(new Uint8Array(bits)) };
}

async function verifyPassword(password, record) {
  if (!record) return false;
  const candidate = await passwordRecord(password, new Uint8Array(record.salt));
  return candidate.hash.reduce((difference, value, i) => difference | (value ^ record.hash[i]), 0) === 0;
}

export class FarmaModel {
  constructor(storage = globalThis.localStorage, session = globalThis.sessionStorage) {
    this.storage = storage;
    this.session = session;
    this.initializing = null;
  }

  async initialize() {
    if (this.storage.getItem(DATA_KEY)) return;
    if (!this.initializing) {
      this.initializing = (async () => {
        const state = createSeed();
        const credentials = {};
        for (const user of state.users) credentials[user.id] = await passwordRecord('Farma2026!');
        this.persist({ state, credentials });
      })();
    }
    await this.initializing;
  }

  read() {
    try {
      const data = JSON.parse(this.storage.getItem(DATA_KEY));
      if (!data?.state?.users || !data.credentials) throw new Error();
      return data;
    } catch {
      throw new RequestError('No se pudieron leer los datos del sistema. Revisa el almacenamiento de este navegador.');
    }
  }

  persist(data) {
    try {
      this.storage.setItem(DATA_KEY, JSON.stringify(data));
    } catch {
      throw new RequestError('No se pudo guardar la operación. Revisa el espacio y los permisos de almacenamiento del navegador.');
    }
  }

  currentUser(data) {
    let session;
    try { session = JSON.parse(this.session.getItem(SESSION_KEY)); } catch { session = null; }
    const user = data.state.users.find(u => u.id === session?.id && u.active);
    if (!user || session.expires <= Date.now()) {
      this.session.removeItem(SESSION_KEY);
      throw new RequestError('Ingresa con tu correo y contraseña.', 401);
    }
    return user;
  }

  packet(data, user, operationId = null) {
    const state = structuredClone(data.state);
    if (user.role === 'Almacenero') {
      state.clients = state.clients.map(c => ({ id: c.id, name: 'Cliente' }));
      state.recipes = [];
    }
    if (user.role !== 'Administrador') state.users = state.users.map(u => ({ id: u.id, name: u.name }));
    return { actor: { ...user }, state, operationId };
  }

  async request(url, input) {
    await this.initialize();
    const data = this.read();
    if (url === '/api/login') {
      const email = String(input?.email || '').trim().toLowerCase();
      const user = data.state.users.find(u => u.email.toLowerCase() === email && u.active);
      if (!user || !await verifyPassword(String(input?.password || ''), data.credentials[user.id]))
        throw new RequestError('Correo o contraseña incorrectos.', 401);
      this.session.setItem(SESSION_KEY, JSON.stringify({ id: user.id, expires: Date.now() + 7200000 }));
      return { actor: { ...user } };
    }
    if (url === '/api/logout') {
      this.session.removeItem(SESSION_KEY);
      return { ok: true };
    }
    const user = this.currentUser(data);
    if (url === '/api/state') return this.packet(data, user);
    const route = url.replace(/^\/api\//, '');
    const action = ROUTES[route];
    if (!action) throw new RequestError('Operación no disponible.', 404);
    if (action === 'recipe' && input.expiry < day()) throw new RequestError('La receta debe estar vigente.');
    if (['sale', 'purchase'].includes(action) && (!Array.isArray(input.items) || input.items.length > 100))
      throw new RequestError('Agrega entre 1 y 100 lotes.');
    if (action === 'user' && (String(input.password || '').length < 10 || String(input.password).length > 128))
      throw new RequestError('Ingresa una contraseña de entre 10 y 128 caracteres.');
    let state;
    try { state = applyOperation(data.state, action, input, user); }
    catch (error) {
      throw new RequestError(error.message, error.message.includes('permiso') ? 403 : 400);
    }
    const candidate = { state, credentials: { ...data.credentials } };
    if (action === 'user') candidate.credentials[state.users.at(-1).id] = await passwordRecord(input.password);
    this.persist(candidate);
    const operationId = action === 'sale' ? state.sales.at(-1).id : action === 'purchase' ? state.purchases.at(-1).id : null;
    return this.packet(candidate, user, operationId);
  }
}

const model = new FarmaModel();
export const browserRequest = (url, input) => model.request(url, input);
