import { browserRequest } from './Models/FarmaModel.js';
import { ROLES, allowed, alerts, lotStatus, money, day, offsetDay, daysUntil, round } from './domain.js';

const paths = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  bag:'M5 7h14l1 14H4L5 7z M9 8V6a3 3 0 0 1 6 0v2',
  box:'m3 7 9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M7 5l10 5',
  truck:'M3 5h12v12H3z M15 9h4l3 4v4h-7 M5 17a2 2 0 1 0 4 0 M16 17a2 2 0 1 0 4 0',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8',
  file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  chart:'M3 3v18h18 M7 15v3 M12 9v9 M17 5v13',
  settings:'M9 4h6l1 3 3 1v6l-3 1-1 4H9l-1-4-3-1V8l3-1z M15 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  logout:'M9 21H4V3h5 M9 12h12 M17 8l4 4-4 4',
  search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M17 17l4 4',
  plus:'M12 5v14 M5 12h14',
  arrow:'M5 12h14 M14 7l5 5-5 5',
  chevron:'m9 5 7 7-7 7',
  download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  pill:'m9 15 6-6 M5.5 18.5a5 5 0 0 1 0-7l6-6a5 5 0 0 1 7 7l-6 6a5 5 0 0 1-7 0z',
  check:'m5 12 4 4L19 6',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  edit:'m15 4 5 5 M4 15 15 4a3.5 3.5 0 0 1 5 5L9 20l-6 1z',
  x:'M6 6l12 12 M18 6 6 18',
  clock:'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0 M12 7v5l3 2',
  wallet:'M3 5h17v15H3z M3 5V3h14 M15 10h6v5h-6z',
  info:'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0 M12 11v6 M12 7h.01',
  menu:'M4 6h16 M4 12h16 M4 18h16',
  undo:'M3 10h11a7 7 0 0 1 0 14 M3 10l5-5 M3 10l5 5',
  print:'M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 14h12v8H6z',
  play:'m9 5 12 7-12 7z',
  shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-5',
  refresh:'M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 14-2l1 1 M4 17l1 1a8 8 0 0 0 14-2'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.box}"/></svg>`;
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const root = document.querySelector('#root'), modal = document.querySelector('#modal');
const pendingForms = new WeakSet();
let storageNotice = '';
let state = Object.fromEntries(['products','lots','clients','suppliers','users','recipes','sales','purchases','movements'].map(key => [key,[]]));
let actor = null, page = 'resumen', filter = 'all', cart = [], purchaseDraft = [], reportFrom = offsetDay(-6), reportTo = day(), toastTimer;
async function request(url, body) {
  try { return await browserRequest(url, body); }
  catch (error) {
    if (error.status === 401 && url !== '/api/login') { actor = null; login(); }
    throw error;
  }
}

async function refresh() {
  const packet = await request('/api/state'); state=packet.state; actor=packet.actor;
}
const names = { resumen:'Resumen', ventas:'Ventas', inventario:'Inventario', compras:'Compras', clientes:'Clientes', recetas:'Recetas', alertas:'Alertas', reportes:'Reportes', usuarios:'Usuarios' };
const navItems = [ ['resumen','grid'],['ventas','bag'],['inventario','box'],['compras','truck'],['clientes','users'],['recetas','file'],['alertas','bell'],['reportes','chart'],['usuarios','settings'] ];
function visiblePage(p) {
  return ({ ventas:[0,1], compras:[0,2], clientes:[0,1,3], recetas:[0,3], reportes:[0], usuarios:[0] }[p] || [0,1,2,3]).includes(ROLES.indexOf(actor?.role));
}
const productOf = lot => state.products.find(p => p.id === lot.productId);
const clientName = value => state.clients.find(c => c.id === value)?.name || 'Cliente';
const supplierName = value => state.suppliers.find(s => s.id === value)?.name || 'Proveedor';
const userName = value => state.users.find(u => u.id === value)?.name || 'Usuario';
const fmtDate = value => new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('es-PE', {day:'2-digit',month:'short',year:'numeric'});
const initials = value => value.split(' ').map(x => x[0]).slice(0,2).join('');
const actionButton = (label, action, opts = {}) => `<button type="button" class="btn ${opts.primary ? 'primary' : opts.soft ? 'soft' : ''} ${opts.small ? 'sm' : ''}" data-action="${action}" ${opts.id ? `data-id="${opts.id}"` : ''}>${opts.icon ? icon(opts.icon) : ''}${h(label)}</button>`;
const badge = (label, tone = 'green') => `<span class="badge ${tone}">${h(label)}</span>`;
const brand = () => `<div class="brand"><div class="brand-symbol">+</div><div><div class="brand-name">FARMACONTROL</div><div class="brand-sub">Gestión farmacéutica</div></div></div>`;
function toast(message, error = false) {
  const node = document.querySelector('#toast'); node.textContent = message; node.className = `visible${error ? ' error' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.className = '', 4800);
}
async function save(action, input) {
  const routes = {client:'clientes',product:'medicamentos',lot:'lotes',sale:'ventas',cancelSale:'ventas/anular',purchase:'compras',recipe:'recetas',supplier:'proveedores',user:'usuarios',userToggle:'usuarios/estado'};
  const packet = await request('/api/'+routes[action],input);
  state=packet.state; actor=packet.actor;
  return packet.operationId;
}
function heading(title, subtitle, buttons = '', eyebrow = 'GESTIÓN DE FARMACIA') {
  return `<div class="page-heading"><div><div class="eyebrow">${h(eyebrow)}</div><h1>${h(title)}</h1><p>${h(subtitle)}</p></div><div class="button-row">${buttons}</div></div>`;
}
function stats(cards) {
  return `<div class="stats">${cards.map(c => `<div class="stat"><div class="stat-top"><span class="stat-label">${h(c[0])}</span>${icon(c[3] || 'chart')}</div><div class="stat-value">${h(c[1])}</div><div class="stat-note ${c[4] ? 'good' : ''}">${h(c[2])}</div></div>`).join('')}</div>`;
}
function panelHead(title, subtitle, buttons = '') { return `<div class="panel-head"><div><h2>${h(title)}</h2><p>${h(subtitle)}</p></div><div class="button-row">${buttons}</div></div>`; }
function empty(text = 'No hay registros para mostrar.') { return `<div class="empty">${icon('box')}${h(text)}</div>`; }
function table(headers, rows, countLabel = 'registros') {
  return `<div class="table-scroll"><table><thead><tr>${headers.map(v => `<th>${h(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr data-record data-search="${h(r.search || '')}">${r.html}</tr>`).join('') || `<tr><td colspan="${headers.length}">${empty()}</td></tr>`}<tr data-search-empty hidden><td colspan="${headers.length}">${empty('No se encontraron coincidencias.')}</td></tr></tbody></table></div><div class="table-bottom"><span>${rows.length} ${h(countLabel)}</span><span>FarmaControl</span></div>`;
}
function search(placeholder = 'Buscar en la lista…') { return `<label class="filter-search">${icon('search')}<input aria-label="${h(placeholder)}" class="input" data-search-table placeholder="${h(placeholder)}"/></label>`; }
function tabs(options) { return `<div class="tabs">${options.map(([key,label]) => `<button class="tab ${filter === key ? 'active' : ''}" data-action="filter" data-filter="${key}">${h(label)}</button>`).join('')}</div>`; }
function chart(sales = state.sales) {
  const days = Array.from({length:7}, (_,i) => offsetDay(-6+i));
  const values = days.map(d => sales.filter(s => s.status === 'CONFIRMADA' && day(s.date) === d).reduce((sum,s) => sum + s.total,0));
  const max = Math.max(1,...values);
  return `<div class="chart" role="img" aria-label="Importes de ventas confirmadas de los últimos siete días">${days.map((d,i) => `<div class="chart-col" title="${h(fmtDate(d))}: ${h(money(values[i]))}"><div class="chart-bar" style="height:${Math.max(2,values[i]/max*100)}%"></div><span>${new Date(d+'T12:00:00').toLocaleDateString('es-PE',{weekday:'short'})}</span></div>`).join('')}</div><div class="chart-legend">Ventas confirmadas · últimos 7 días</div>`;
}
function login() {
  document.title='FarmaControl · Acceso';
  root.innerHTML = document.querySelector('#login-template').innerHTML;
}
function shell() {
  const activeAlerts = alerts(state).length;
  root.innerHTML = `<div class="shell" id="shell"><button class="menu-scrim" data-action="menu" aria-label="Cerrar menú"></button><aside class="sidebar">${brand()}<div class="nav-label">ESPACIO DE TRABAJO</div><nav aria-label="Navegación principal">${navItems.filter(([p]) => visiblePage(p)).map(([p,i]) => `<a class="nav-item ${p === page ? 'active' : ''}" href="#${p}" data-nav="${p}">${icon(i)}<span>${names[p]}</span>${p === 'alertas' && activeAlerts ? `<span class="nav-count">${activeAlerts}</span>` : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-user"><div class="avatar">${h(initials(actor.name))}</div><div><div class="user-name">${h(actor.name)}</div><div class="user-role">${h(actor.role)}</div></div></div><button class="logout" data-action="logout">${icon('logout')}Cerrar sesión</button></div></aside><div class="workspace"><header class="topbar"><div class="topbar-left"><button class="btn icon-btn mobile-menu" data-action="menu" aria-label="Abrir menú">${icon('menu')}</button><div><div class="topbar-caption">${h(new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'}))}</div><h2 class="topbar-title">${names[page]}</h2></div></div><div class="header-tools"><form class="search-wrap" id="global-search">${icon('search')}<input aria-label="Buscar medicamentos" name="search" placeholder="Buscar medicamentos…"/><kbd>↵</kbd></form><button class="btn icon-btn notification" data-action="go-alertas" aria-label="Ver alertas">${icon('bell')}</button>${allowed(actor.role,'sale') ? actionButton('Nueva venta','new-sale',{primary:true,icon:'plus'}) : actionButton('Ver inventario','go-inventario',{icon:'box'})}</div></header><main class="content" id="content"></main></div></div>`;
  renderPage();
}
function renderPage() {
  document.title = `${names[page]} · FarmaControl`;
  const screens = { resumen:home, ventas:salesPage, inventario:inventoryPage, compras:purchasesPage, clientes:clientsPage, recetas:recipesPage, alertas:alertsPage, reportes:reportsPage, usuarios:usersPage };
  document.querySelector('#content').innerHTML = (storageNotice ? `<p class="notice amber">${h(storageNotice)}</p>` : '') + screens[page]() + `<p class="footnote">FarmaControl · Gestión de ventas e inventario</p>`;
}
async function navigate(next) {
  await refresh();
  page = names[next] && visiblePage(next) ? next : 'resumen'; filter = 'all';
  if (location.hash !== '#'+page) history.replaceState(null,'','#'+page);
  shell(); window.scrollTo({top:0});
}
function home() {
  const confirmed = state.sales.filter(s => s.status === 'CONFIRMADA'), today = confirmed.filter(s => day(s.date) === day());
  const total = today.reduce((sum,s) => sum+s.total,0), currentAlerts = alerts(state), units = state.lots.filter(l => l.expiry >= day()).reduce((sum,l) => sum+l.stock,0);
  return heading('Todo bajo control','Una mirada a las operaciones de tu farmacia.',actionButton('Consultar inventario','go-inventario',{icon:'box'}),'RESUMEN GENERAL') + stats([
    ['Ventas del día',money(total),`${today.length} operaciones confirmadas`,'wallet',true],
    ['Medicamentos',state.products.length,'Productos en el catálogo','pill'],
    ['Unidades disponibles',units,'Existencias de lotes no vencidos','box'],
    ['Alertas activas',currentAlerts.length,'Inventario que requiere atención','bell']
  ]) + `<div class="grid-two"><section class="panel">${panelHead('Actividad de ventas','Importes registrados durante la última semana.',visiblePage('reportes') ? actionButton('Ver reportes','go-reportes',{small:true,icon:'arrow'}) : '')}<div class="panel-body">${chart()}</div></section><section class="panel">${panelHead('Accesos rápidos','Las tareas de cada día, a un clic.')}<div class="panel-body">${[
    allowed(actor.role,'sale') ? ['Registrar una venta','new-sale','bag'] : null,
    allowed(actor.role,'purchase') ? ['Recibir una compra','new-purchase','truck'] : null,
    ['Consultar inventario','go-inventario','box'],['Revisar alertas','go-alertas','bell']
  ].filter(Boolean).map(([label,action,i]) => `<button class="quick-link" data-action="${action}">${icon(i)}${label}${icon('chevron')}</button>`).join('')}</div></section></div><div class="grid-two"><section class="panel">${panelHead('Últimas ventas','Movimientos recientes de la farmacia.')}<div class="panel-body">${[...state.sales].reverse().slice(0,4).map(s => `<div class="list-item"><div class="list-icon green">${icon('bag')}</div><div class="list-item-text"><strong>${h(s.code)}</strong><small>${h(clientName(s.clientId))} · ${fmtDate(s.date)}</small></div>${badge(s.status === 'ANULADA' ? 'Anulada' : 'Confirmada',s.status === 'ANULADA'?'red':'green')}<span class="mini-total">${money(s.total)}</span></div>`).join('') || empty()}</div></section><section class="panel">${panelHead('Atención al inventario','Stock y fechas de vencimiento.')}<div class="panel-body">${currentAlerts.slice(0,4).map(l => `<div class="list-item"><div class="list-icon ${l.status.tone}">${icon('clock')}</div><div class="list-item-text"><strong>${h(l.product.name)}</strong><small>Lote ${h(l.code)} · ${l.stock} unidades</small></div>${badge(l.status.label,l.status.tone)}</div>`).join('') || empty('Sin alertas por el momento.')}</div></section></div>`;
}
function salesPage() {
  const confirmed = state.sales.filter(s => s.status === 'CONFIRMADA'), total = confirmed.reduce((sum,s) => sum+s.total,0);
  const rows = [...state.sales].reverse().filter(s => filter === 'all' || s.status === filter).map(s => ({search:`${s.code} ${clientName(s.clientId)}`,html:`<td><strong>${h(s.code)}</strong><div class="cell-sub">${s.type === 'BOLETA' ? 'Boleta' : 'Factura'} interna</div></td><td>${h(clientName(s.clientId))}</td><td>${fmtDate(s.date)}</td><td><strong>${money(s.total)}</strong></td><td>${badge(s.status === 'CONFIRMADA'?'Confirmada':'Anulada',s.status === 'CONFIRMADA'?'green':'red')}</td><td class="right"><button class="table-action" title="Ver comprobante" aria-label="Ver comprobante ${h(s.code)}" data-action="receipt" data-id="${s.id}">${icon('eye')}</button>${allowed(actor.role,'cancelSale') && s.status === 'CONFIRMADA' ? `<button class="table-action" title="Anular venta" aria-label="Anular venta ${h(s.code)}" data-action="cancel-sale" data-id="${s.id}">${icon('undo')}</button>` : ''}</td>`}));
  return heading('Ventas y comprobantes','Supervisa las ventas, consulta sus detalles y revisa cada operación.',allowed(actor.role,'sale') ? actionButton('Registrar venta','new-sale',{primary:true,icon:'plus'}) : '','CONTROL COMERCIAL') + stats([
    ['Ventas confirmadas',money(total),'Importe acumulado de ventas','wallet'],['Ticket promedio',money(total/(confirmed.length||1)),'Por operación confirmada','chart'],['Operaciones',confirmed.length,'Ventas confirmadas','bag'],['Ventas anuladas',state.sales.filter(s=>s.status==='ANULADA').length,'Historial conservado','undo']
  ]) + `<section class="panel">${panelHead('Historial de ventas','Consulta tus operaciones y constancias de venta.',actionButton('Descargar','export',{icon:'download',small:true}))}<div class="filters">${tabs([['all','Todas'],['CONFIRMADA','Confirmadas'],['ANULADA','Anuladas']])}${search('Buscar comprobante o cliente…')}</div>${table(['Comprobante','Cliente','Fecha','Total','Estado','Acciones'],rows,'ventas')}</section>`;
}
function inventoryPage() {
  const rows = state.lots.filter(l => {
    const status = lotStatus(l);
    return filter === 'all' || (filter === 'low' ? l.stock <= l.min && l.expiry >= day() : status.key === filter);
  }).map(l => { const p=productOf(l),status=lotStatus(l);return {search:`${p.name} ${p.sku} ${l.code} ${p.category}`,html:`<td><div class="cell-main"><div class="product-icon">${icon('pill')}</div><div><strong>${h(p.name)}</strong><div class="cell-sub">${h(p.category)}${p.rx?' · Con receta':''}</div></div></div></td><td>${h(l.code)}<div class="cell-sub">${h(p.sku)}</div></td><td>${fmtDate(l.expiry)}</td><td><strong>${l.stock}</strong><div class="cell-sub">Mínimo ${l.min}</div></td><td>${money(p.price)}</td><td>${badge(status.label,status.tone)}</td><td class="right">${allowed(actor.role,'product') ? `<button class="table-action" data-action="edit-product" data-id="${p.id}" aria-label="Editar ${h(p.name)}">${icon('edit')}</button>` : ''}</td>`}; });
  return heading('Medicamentos y lotes','Stock clasificado por medicamento, lote y fecha de vencimiento.',allowed(actor.role,'product') ? actionButton('Registrar lote','new-lot',{icon:'plus'}) + actionButton('Nuevo medicamento','new-product',{primary:true,icon:'plus'}) : '','CONTROL DE EXISTENCIAS') + `<section class="panel">${panelHead('Catálogo de medicamentos','Información del inventario de la farmacia.',actionButton('Descargar','export',{icon:'download',small:true}))}<div class="filters">${tabs([['all','Todos'],['low','Stock bajo'],['near','Por vencer'],['expired','Vencidos']])}${search('Buscar medicamento, código o lote…')}</div>${table(['Medicamento','Lote / código','Vencimiento','Stock','Precio','Estado',''],rows,'lotes')}</section><p class="section-note">Los lotes vencidos se muestran para control y se excluyen de la venta. Un lote nuevo comienza en cero; sus unidades ingresan mediante una compra.</p>`;
}
function clientsPage() {
  const rows = state.clients.map(c => ({search:`${c.name} ${c.doc} ${c.phone}`,html:`<td><strong>${h(c.doc)}</strong><div class="cell-sub">${c.docType}</div></td><td><strong>${h(c.name)}</strong></td><td>${h(c.phone)||'—'}</td><td>${state.sales.filter(s=>s.clientId===c.id&&s.status==='CONFIRMADA').length} operaciones</td><td>${badge('Registrado')}</td><td class="right">${allowed(actor.role,'client') ? `<button class="table-action" data-action="edit-client" data-id="${c.id}" aria-label="Editar ${h(c.name)}">${icon('edit')}</button>` : ''}</td>`}));
  return heading('Directorio de clientes','Datos organizados para una atención cercana y ágil.',allowed(actor.role,'client') ? actionButton('Nuevo cliente','new-client',{primary:true,icon:'plus'}) : '','RELACIÓN CON EL CLIENTE') + stats([
    ['Clientes registrados',state.clients.length,'Personas y empresas registradas','users'],['Personas naturales',state.clients.filter(c=>c.docType!=='RUC').length,'Identificados por documento','file'],['Empresas',state.clients.filter(c=>c.docType==='RUC').length,'Clientes con RUC','box'],['Clientes con compras',new Set(state.sales.filter(s=>s.status==='CONFIRMADA').map(s=>s.clientId)).size,'Con operaciones confirmadas','bag']
  ]) + `<section class="panel">${panelHead('Clientes registrados','Consulta o actualiza los datos de tus clientes.',actionButton('Descargar','export',{icon:'download',small:true}))}<div class="filters">${search('Buscar nombre o documento…')}</div>${table(['Documento','Nombre / razón social','Teléfono','Ventas','Estado',''],rows,'clientes')}</section>`;
}
function purchasesPage() {
  const rows = [...state.purchases].reverse().map(p => ({search:`${p.document} ${supplierName(p.supplierId)}`,html:`<td><strong>${h(p.document)}</strong></td><td>${h(supplierName(p.supplierId))}</td><td>${fmtDate(p.date)}</td><td>${p.items.reduce((s,i)=>s+i.qty,0)} unidades</td><td><strong>${money(p.total)}</strong></td><td>${badge('Recibida')}</td>`}));
  return heading('Compras y abastecimiento','Recibe mercadería y mantén el inventario al día.',allowed(actor.role,'purchase') ? actionButton('Nuevo proveedor','new-supplier',{icon:'plus'})+actionButton('Registrar compra','new-purchase',{primary:true,icon:'plus'}) : '','GESTIÓN DEL ALMACÉN') + stats([
    ['Compras recibidas',state.purchases.length,'Recepciones registradas','truck'],['Importe de compras',money(state.purchases.reduce((s,p)=>s+p.total,0)),'Costo de abastecimiento','wallet'],['Proveedores',state.suppliers.filter(s=>s.active).length,'Abastecedores activos','users'],['Lotes registrados',state.lots.length,'Trazabilidad de existencias','box']
  ]) + `<section class="panel">${panelHead('Historial de compras','El ingreso de cada compra incrementa el stock del lote.',actionButton('Descargar','export',{icon:'download',small:true}))}<div class="filters">${search('Buscar documento o proveedor…')}</div>${table(['Documento','Proveedor','Fecha','Recepción','Total','Estado'],rows,'compras')}</section><section class="panel">${panelHead('Proveedores','Directorio de abastecedores.')}<div class="panel-body">${state.suppliers.map(s=>`<div class="list-item"><div class="list-icon green">${icon('truck')}</div><div class="list-item-text"><strong>${h(s.name)}</strong><small>RUC ${h(s.ruc)} · ${h(s.phone)||'Sin teléfono'}</small></div>${badge(s.active?'Activo':'Inactivo',s.active?'green':'gray')}</div>`).join('')}</div></section>`;
}
function recipesPage() {
  const rows = state.recipes.map(r => {const valid=r.status==='VALIDA'&&r.issued<=day()&&r.expiry>=day();return {search:`${r.code} ${clientName(r.clientId)} ${r.prescriber}`,html:`<td><strong>${h(r.code)}</strong></td><td>${h(clientName(r.clientId))}</td><td>${h(r.prescriber)}</td><td>${fmtDate(r.issued)}</td><td>${fmtDate(r.expiry)}</td><td>${badge(valid?'Vigente':'Vencida',valid?'green':'red')}</td>`};});
  return heading('Recetas médicas','Referencias de prescripción asociadas a cada cliente.',allowed(actor.role,'recipe') ? actionButton('Registrar receta','new-recipe',{primary:true,icon:'plus'}) : '','CONTROL DE DISPENSACIÓN')+`<section class="panel">${panelHead('Recetas registradas','Consulta su registro, vigencia y cliente asociado.')}<div class="filters">${search('Buscar receta o cliente…')}</div>${table(['Número','Cliente','Prescriptor','Emisión','Vencimiento','Estado'],rows,'recetas')}</section><p class="section-note">Se comprueban las fechas y la pertenencia al cliente. La revisión del contenido y autenticidad de una receta corresponde al profesional farmacéutico.</p>`;
}
function alertsPage() {
  const list = alerts(state), expired=list.filter(l=>l.expiry<day()), near=list.filter(l=>l.expiry>=day()&&daysUntil(l.expiry)<=30), low=list.filter(l=>l.stock<=l.min&&l.expiry>=day());
  const rows = list.filter(l => filter==='all'||(filter==='low'?l.stock<=l.min&&l.expiry>=day():l.status.key===filter)).map(l=>({search:`${l.product.name} ${l.code}`,html:`<td><div class="cell-main"><div class="product-icon">${icon('pill')}</div><div><strong>${h(l.product.name)}</strong><div class="cell-sub">${h(l.product.sku)}</div></div></div></td><td>${h(l.code)}</td><td>${fmtDate(l.expiry)}</td><td>${l.stock} / mínimo ${l.min}</td><td>${badge(l.status.label,l.status.tone)}</td><td>${l.expiry<day()?'Separar del inventario disponible':l.stock<=l.min?'Revisar abastecimiento':'Priorizar revisión del lote'}</td>`}));
  return heading('Alertas de inventario','Identifica a tiempo los productos que necesitan atención.','','SEGUIMIENTO PREVENTIVO')+stats([
    ['Alertas activas',list.length,'Lotes que requieren revisión','bell'],['Stock bajo',low.length,'Incluye lotes sin existencias','box'],['Por vencer',near.length,'En los próximos 30 días','clock'],['Lotes vencidos',expired.length,'No disponibles para venta','shield']
  ])+`<section class="panel">${panelHead('Productos que requieren atención','Las alertas se calculan con las existencias y las fechas de vencimiento.',actionButton('Descargar','export',{icon:'download',small:true}))}<div class="filters">${tabs([['all','Todas'],['low','Stock bajo'],['near','Por vencer'],['expired','Vencidos']])}${search('Buscar medicamento o lote…')}</div>${table(['Medicamento','Lote','Vencimiento','Existencias','Alerta','Acción sugerida'],rows,'alertas')}</section>`;
}
function reportsPage() {
  const selected = state.sales.filter(s=>s.status==='CONFIRMADA'&&day(s.date)>=reportFrom&&day(s.date)<=reportTo);
  const total=selected.reduce((sum,s)=>sum+s.total,0);
  const stockValue=state.lots.filter(l=>l.expiry>=day()).reduce((sum,l)=>sum+l.stock*productOf(l).price,0);
  const sold = state.products.map(p=>({...p,qty:selected.reduce((sum,s)=>sum+s.items.filter(i=>i.productId===p.id).reduce((a,i)=>a+i.qty,0),0)})).filter(p=>p.qty>0).sort((a,b)=>b.qty-a.qty);
  const rows=[...selected].reverse().map(s=>({search:`${s.code} ${clientName(s.clientId)}`,html:`<td><strong>${h(s.code)}</strong></td><td>${h(clientName(s.clientId))}</td><td>${fmtDate(s.date)}</td><td>${s.items.reduce((a,i)=>a+i.qty,0)} unidades</td><td><strong>${money(s.total)}</strong></td>`}));
  return heading('Reportes de gestión','Indicadores calculados a partir de las operaciones registradas.',actionButton('Descargar reporte','export',{icon:'download'}),'INFORMACIÓN PARA DECIDIR')+`<section class="panel">${panelHead('Periodo de consulta','Selecciona las fechas de las ventas confirmadas.')}<form id="report-form" class="panel-body date-range"><label>Desde<input class="input" name="from" type="date" value="${reportFrom}" required/></label><label>Hasta<input class="input" name="to" type="date" value="${reportTo}" required/></label><button class="btn primary" type="submit">Aplicar periodo</button></form></section>`+stats([
    ['Ventas del periodo',money(total),`${selected.length} operaciones confirmadas`,'wallet'],['Ticket promedio',money(total/(selected.length||1)),'Calculado según el periodo','chart'],['Valor de existencias',money(stockValue),'A precio de venta; excluye vencidos','box'],['Unidades vendidas',selected.reduce((sum,s)=>sum+s.items.reduce((a,i)=>a+i.qty,0),0),'Según el periodo seleccionado','bag']
  ])+`<div class="grid-equal"><section class="panel">${panelHead('Evolución semanal','Últimos siete días, independientemente del filtro.')}<div class="panel-body">${chart()}</div></section><section class="panel">${panelHead('Medicamentos más vendidos','Unidades vendidas dentro del periodo.')}<div class="panel-body">${sold.slice(0,5).map((p,i)=>`<div class="list-item"><div class="avatar">${i+1}</div><div class="list-item-text"><strong>${h(p.name)}</strong><small>${h(p.category)}</small></div><span class="mini-total">${p.qty} uds.</span></div>`).join('')||empty('Sin ventas en el periodo.')}</div></section></div><section class="panel">${panelHead('Detalle del periodo','Las operaciones anuladas se excluyen de los importes.')}${table(['Comprobante','Cliente','Fecha','Cantidad','Importe'],rows,'ventas')}</section>`;
}
function usersPage() {
  const rows=state.users.map(u=>({search:`${u.name} ${u.email} ${u.role}`,html:`<td><div class="cell-main"><div class="avatar">${h(initials(u.name))}</div><strong>${h(u.name)}</strong></div></td><td>${h(u.email)}</td><td>${h(u.role)}</td><td>${badge(u.active?'Activo':'Inactivo',u.active?'green':'gray')}</td><td class="right">${u.id!==actor.id ? `<button class="btn sm" data-action="toggle-user" data-id="${u.id}">${u.active?'Desactivar':'Activar'}</button>` : '<span class="cell-sub">Perfil actual</span>'}</td>`}));
  return heading('Usuarios y perfiles','Organiza los usuarios y sus responsabilidades.',actionButton('Nuevo perfil','new-user',{primary:true,icon:'plus'}),'ORGANIZACIÓN DEL EQUIPO')+`<section class="panel">${panelHead('Usuarios registrados','Cada rol muestra las tareas asociadas a su trabajo.')}<div class="filters">${search('Buscar nombre, correo o rol…')}</div>${table(['Nombre','Correo','Rol','Estado',''],rows,'perfiles')}</section><section class="panel">${panelHead('Distribución de responsabilidades','Referencia de roles del proyecto.')}<div class="panel-body">${ROLES.map((role,i)=>`<div class="list-item"><div class="list-icon green">${icon(['settings','bag','box','file'][i])}</div><div class="list-item-text"><strong>${role}</strong><small>${['Supervisa operaciones, anula ventas y administra perfiles.','Registra clientes y ventas; consulta medicamentos.','Recibe compras y administra medicamentos, lotes y proveedores.','Registra recetas y consulta alertas y medicamentos.'][i]}</small></div></div>`).join('')}</div></section>`;
}

function showModal(title, body, wide=false) {
  modal.className=wide?'wide-dialog':'';
  modal.innerHTML=`<div class="modal-head"><h2 id="modal-title">${h(title)}</h2><button class="close-btn" data-action="close-modal" aria-label="Cerrar ventana">${icon('x')}</button></div><div class="modal-body">${body}</div>`;
  modal.showModal();
}
const inputField=(name,label,value='',options={})=>`<div class="field ${options.full?'full':''}"><label for="f-${name}">${h(label)}</label><input class="input" id="f-${name}" name="${name}" type="${options.type||'text'}" value="${h(value)}" ${options.optional?'':'required'} ${options.min!==undefined?`min="${options.min}"`:''} ${options.max!==undefined?`max="${options.max}"`:''} ${options.step?`step="${options.step}"`:''} maxlength="${options.length||160}" ${options.readonly?'readonly':''}/></div>`;
const selectField=(name,label,options,selected='')=>`<div class="field"><label for="f-${name}">${h(label)}</label><select class="input" name="${name}" id="f-${name}">${options.map(([value,text])=>`<option value="${h(value)}" ${String(value)===String(selected)?'selected':''}>${h(text)}</option>`).join('')}</select></div>`;
const modalFooter=(label='Guardar')=>`<div class="modal-footer"><button class="btn" type="button" data-action="close-modal">Cancelar</button><button class="btn primary" type="submit">${h(label)}</button></div>`;
const formError=()=>'<div class="form-error" role="alert" hidden></div>';
function entityForm(type, existingId) {
  let title='',fields='',idValue=existingId||'', intro='';
  if(type==='client') {
    const c=state.clients.find(c=>c.id===Number(existingId))||{}; title=c.id?'Editar cliente':'Nuevo cliente';
    fields=selectField('docType','Tipo de documento',[['DNI','DNI'],['RUC','RUC'],['CE','Carné de extranjería'],['OTR','Otro']],c.docType||'DNI')+inputField('doc','Número de documento',c.doc||'',{length:15})+inputField('name','Nombre / razón social',c.name||'',{full:true})+inputField('phone','Teléfono (opcional)',c.phone||'',{optional:true,length:20});
  } else if(type==='product') {
    const p=state.products.find(p=>p.id===Number(existingId))||{};title=p.id?'Editar medicamento':'Nuevo medicamento';
    fields=inputField('sku','Código / SKU',p.sku||`MED-${String(state.products.length+1).padStart(3,'0')}`,{length:30})+inputField('name','Nombre',p.name||'')+inputField('category','Categoría',p.category||'')+inputField('presentation','Presentación',p.presentation||'',{length:90})+inputField('price','Precio de venta S/',p.price??'',{type:'number',min:0,step:'.01'})+`<label class="check-field"><input type="checkbox" name="rx" ${p.rx?'checked':''}/>Requiere receta médica</label>`;
    intro='Después de registrar el medicamento, crea su lote y registra una compra para ingresar existencias.';
  } else if(type==='lot') {
    title='Registrar lote';intro='El lote comienza con cero unidades. Registra una compra para recibir mercadería.';
    fields=selectField('productId','Medicamento',state.products.map(p=>[p.id,p.name]))+inputField('code','Código de lote','',{length:60})+inputField('expiry','Fecha de vencimiento',offsetDay(180),{type:'date',min:day()})+inputField('min','Stock mínimo',10,{type:'number',min:0,step:'1'});
  } else if(type==='recipe') {
    title='Registrar receta';intro='Registra la referencia de la receta y su vigencia.';
    fields=selectField('clientId','Cliente',state.clients.map(c=>[c.id,c.name]))+inputField('code','Número de receta',`REC-${String(state.recipes.length+41).padStart(5,'0')}`,{length:50})+inputField('prescriber','Nombre del prescriptor','',{full:true})+inputField('issued','Fecha de emisión',day(),{type:'date',max:day()})+inputField('expiry','Fecha de vencimiento',offsetDay(30),{type:'date'});
  } else if(type==='supplier') {
    title='Nuevo proveedor';fields=inputField('ruc','RUC','',{length:11})+inputField('name','Razón social','',{length:180})+inputField('phone','Teléfono (opcional)','',{optional:true,length:20});
  } else if(type==='user') {
    title='Nuevo usuario';intro='Registra el usuario y selecciona su rol.';
    fields=inputField('name','Nombres y apellidos','',{length:120})+inputField('email','Correo','',{type:'email'})+selectField('role','Rol',ROLES.map(r=>[r,r]))+inputField('password','Contraseña inicial (mínimo 10 caracteres)','',{type:'password',length:128});
  }
  showModal(title,`<form data-form="${type}" data-id="${idValue}">${intro?`<p>${h(intro)}</p>`:''}${formError()}<div class="form-grid">${fields}</div>${modalFooter()}</form>`);
}
function recipeOptions(clientId, selected='') {
  return `<option value="">Sin receta / no aplica</option>`+state.recipes.filter(r=>r.clientId===Number(clientId)&&r.status==='VALIDA'&&r.issued<=day()&&r.expiry>=day()).map(r=>`<option value="${r.id}" ${String(r.id)===String(selected)?'selected':''}>${h(r.code)} · vence ${fmtDate(r.expiry)}</option>`).join('');
}
function saleModal() {
  cart=[];
  showModal('Registrar una venta',`<form id="sale-form">${formError()}<div class="order-grid"><div><p>Selecciona los medicamentos y sus lotes disponibles.</p><label class="filter-search" style="margin-bottom:15px;max-width:none">${icon('search')}<input class="input" data-search-catalog placeholder="Buscar medicamento o lote…" aria-label="Buscar producto para la venta"/></label><div class="catalog-list">${state.lots.map(l=>{
    const p=productOf(l),available=l.stock>0&&l.expiry>=day();return `<div class="catalog-item" data-catalog data-search="${h(p.name+' '+l.code+' '+p.sku)}"><div><strong>${h(p.name)}</strong><small>${h(l.code)} · ${l.stock} uds. · ${l.expiry<day()?'Vencido':`Vence ${fmtDate(l.expiry)}`}</small><span class="price">${money(p.price)}</span>${p.rx?' '+badge('Con receta','amber'):''}</div><button class="btn sm ${available?'soft':''}" type="button" data-action="add-cart" data-id="${l.id}" aria-label="Agregar ${h(p.name)} lote ${h(l.code)}" ${available?'':'disabled'}>${icon('plus')}</button></div>`;
  }).join('')}</div></div><div class="order-detail">${selectField('clientId','Cliente',state.clients.map(c=>[c.id,c.name+' · '+c.doc]))}${selectField('type','Tipo de comprobante',[['BOLETA','Boleta interna'],['FACTURA','Factura interna']])}<div class="field"><label for="sale-recipe">Referencia de receta (si aplica)</label><select class="input" name="recipeId" id="sale-recipe">${recipeOptions(state.clients[0]?.id)}</select></div><div id="cart-lines">${empty('Agrega medicamentos para comenzar.')}</div><div class="total-row"><span>Total</span><span id="cart-total">${money(0)}</span></div><button type="submit" class="btn primary wide">Confirmar venta ${icon('arrow')}</button></div></div></form>`,true);
}
function updateCart() {
  document.querySelector('#cart-lines').innerHTML=cart.map(item=>{
    const l=state.lots.find(l=>l.id===item.lotId),p=productOf(l);
    return `<div class="cart-line"><div><strong>${h(p.name)}</strong><small>${h(l.code)} · ${money(p.price)} c/u</small></div><div class="stepper"><button type="button" data-action="less-cart" data-id="${l.id}" aria-label="Quitar una unidad de ${h(p.name)}">−</button><span>${item.qty}</span><button type="button" data-action="add-cart" data-id="${l.id}" aria-label="Agregar una unidad de ${h(p.name)}">+</button></div><strong>${money(item.qty*p.price)}</strong></div>`;
  }).join('')||empty('Agrega medicamentos para comenzar.');
  document.querySelector('#cart-total').textContent=money(cart.reduce((sum,i)=>sum+i.qty*productOf(state.lots.find(l=>l.id===i.lotId)).price,0));
}
function purchaseRow() {
  return `<div class="purchase-line"><select class="input" name="lotId" aria-label="Lote de compra">${state.lots.filter(l=>l.expiry>=day()).map(l=>`<option value="${l.id}">${h(productOf(l).name)} · ${h(l.code)}</option>`).join('')}</select><input class="input" name="qty" type="number" min="1" step="1" value="10" required aria-label="Cantidad de compra"/><input class="input" name="price" type="number" min="0" step=".01" value="5.00" required aria-label="Costo unitario"/><button class="table-action" type="button" data-action="remove-purchase-row" aria-label="Quitar línea">${icon('x')}</button></div>`;
}
function purchaseModal() {
  showModal('Registrar una compra',`<form id="purchase-form"><p>Selecciona el proveedor y los lotes recibidos. Al confirmar se incrementarán las existencias y se registrarán sus movimientos.</p>${formError()}<div class="form-grid">${selectField('supplierId','Proveedor',state.suppliers.filter(s=>s.active).map(s=>[s.id,s.name]))}${inputField('document','Documento de compra',`FC-${day().replaceAll('-','')}-${Date.now().toString().slice(-6)}`,{length:40})}</div><div class="purchase-labels"><span>Medicamento / lote</span><span>Cantidad</span><span>Costo S/</span><span></span></div><div id="purchase-lines">${purchaseRow()}</div><button type="button" class="text-btn" data-action="add-purchase-row">+ Agregar otro lote</button>${modalFooter('Confirmar compra')}</form>`);
}
function receiptModal(idValue) {
  const sale=state.sales.find(s=>s.id===Number(idValue));if(!sale)return;
  const client=state.clients.find(c=>c.id===sale.clientId);
  showModal('Constancia de venta',`<div class="receipt">${brand()}<h3>Farmacia Vida Sana</h3><p>Constancia interna · ${sale.type==='BOLETA'?'Boleta':'Factura'} interna</p>${badge(sale.status==='ANULADA'?'OPERACIÓN ANULADA':'OPERACIÓN CONFIRMADA',sale.status==='ANULADA'?'red':'green')}<div class="receipt-meta"><strong>${h(sale.code)}</strong><br>Fecha: ${fmtDate(sale.date)}<br>Cliente: ${h(client?.name)}<br>${h(client?.docType)}: ${h(client?.doc)}<br>Atendido por: ${h(userName(sale.userId))}</div><table><thead><tr><th>Producto / lote</th><th>Cant.</th><th>P. unit.</th><th>Importe</th></tr></thead><tbody>${sale.items.map(i=>`<tr><td>${h(i.name)}<div class="cell-sub">${h(i.lot)}</div></td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.qty*i.price)}</td></tr>`).join('')}</tbody></table><div class="receipt-total"><span>Total</span><span>${money(sale.total)}</span></div><p style="margin-top:24px">Constancia interna sin validez tributaria.</p><div class="modal-footer print-hide"><button class="btn" data-action="close-modal">Cerrar</button><button class="btn primary" data-action="print">${icon('print')}Imprimir / guardar PDF</button></div></div>`);
}
function confirmModal(title, message, action, idValue='') {
  showModal(title,`<p class="confirm-text">${h(message)}</p><div class="modal-footer"><button class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" data-action="${action}" data-id="${idValue}">Confirmar</button></div>`);
}
function filterTable(value) {
  const query=String(value).trim().toLocaleLowerCase('es');
  const rows=[...document.querySelectorAll('#content tr[data-record]')];
  rows.forEach(row=>row.hidden=!row.dataset.search.toLocaleLowerCase('es').includes(query));
  const emptyRow=document.querySelector('#content [data-search-empty]');
  if(emptyRow)emptyRow.hidden=!rows.length||rows.some(row=>!row.hidden);
}
function exportTable() {
  const tableNode=document.querySelector('#content table');
  if(!tableNode)return toast('No hay una tabla disponible para descargar.',true);
  const indices=[...tableNode.querySelectorAll('thead th')].map((th,i)=>th.textContent.trim()&&th.textContent.trim()!=='Acciones'?i:null).filter(i=>i!==null);
  const csvCell=value=>{
    let str=String(value).replace(/\s+/g,' ').trim();
    if(/^[=+@\-\t\r]/.test(str))str="'"+str;
    return '"'+str.replaceAll('"','""')+'"';
  };
  const csv=[indices.map(i=>csvCell(tableNode.querySelectorAll('thead th')[i].textContent)).join(';')];
  tableNode.querySelectorAll('tr[data-record]').forEach(row=>{
    if(!row.hidden)csv.push(indices.map(i=>csvCell(row.cells[i]?.textContent||'')).join(';'));
  });
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`FarmaControl_${page}_${day()}.csv`;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Reporte descargado en formato CSV.');
}
document.addEventListener('click',async event=>{
  const nav=event.target.closest('[data-nav]');
  if(nav){event.preventDefault();try{await navigate(nav.dataset.nav);}catch(e){toast(e.message,true);}return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,idValue=button.dataset.id;
  try {
    if(action.startsWith('go-')){await navigate(action.slice(3));return;}
    if(action==='menu'){document.querySelector('#shell')?.classList.toggle('menu-open');return;}
    if(action==='logout'){
      await request('/api/logout',{});actor=null;history.replaceState(null,'','#ingreso');login();return;
    }
    if(action==='close-modal'){modal.close();return;}
    if(action==='filter'){filter=button.dataset.filter;renderPage();return;}
    const forms={'new-client':'client','edit-client':'client','new-product':'product','edit-product':'product','new-lot':'lot','new-recipe':'recipe','new-supplier':'supplier','new-user':'user'};
    if(forms[action]){entityForm(forms[action],idValue);return;}
    if(action==='new-sale'){saleModal();return;}
    if(action==='new-purchase'){purchaseModal();return;}
    if(action==='add-cart'){
      const lot=state.lots.find(l=>l.id===Number(idValue)),line=cart.find(i=>i.lotId===lot?.id);
      if(!lot||lot.expiry<day()||lot.stock<(line?.qty||0)+1)throw new Error('El lote está vencido o no tiene unidades suficientes.');
      if(line)line.qty++;else cart.push({lotId:lot.id,qty:1});updateCart();return;
    }
    if(action==='less-cart'){
      const line=cart.find(i=>i.lotId===Number(idValue));if(line)line.qty--;cart=cart.filter(i=>i.qty>0);updateCart();return;
    }
    if(action==='add-purchase-row'){document.querySelector('#purchase-lines').insertAdjacentHTML('beforeend',purchaseRow());return;}
    if(action==='remove-purchase-row'){button.closest('.purchase-line').remove();return;}
    if(action==='receipt'){receiptModal(idValue);return;}
    if(action==='print'){window.print();return;}
    if(action==='export'){exportTable();return;}
    if(action==='cancel-sale'){
      confirmModal('Anular venta','Se conservará la venta en el historial y se devolverán las unidades a sus lotes originales.','confirm-cancel',idValue);return;
    }
    if(action==='confirm-cancel'){
      await save('cancelSale',{id:idValue});modal.close();shell();toast('Venta anulada. Se repusieron las existencias.');return;
    }
    if(action==='toggle-user'){
      await save('userToggle',{id:idValue});shell();toast('Estado del perfil actualizado.');return;
    }
  } catch(error){toast(error.message,true);}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
  if(pendingForms.has(form))return;
  pendingForms.add(form);
  const submitButtons=[...form.querySelectorAll('button[type="submit"]')];
  submitButtons.forEach(button=>button.disabled=true);
  const values=Object.fromEntries(new FormData(form));
  try {
    if(form.id==='login-form'){
      await request('/api/login',values);await navigate('resumen');return;
    }
    if(form.id==='global-search'){
      await navigate('inventario');const input=document.querySelector('[data-search-table]');if(input){input.value=values.search;filterTable(values.search);}return;
    }
    if(form.id==='report-form'){
      if(!values.from||!values.to||values.from>values.to)throw new Error('Selecciona un periodo válido: la fecha inicial debe ser anterior o igual a la final.');
      reportFrom=values.from;reportTo=values.to;renderPage();return;
    }
    if(form.id==='sale-form'){
      const saleId=await save('sale',{...values,items:cart});const last=state.sales.find(s=>s.id===saleId);modal.close();shell();receiptModal(last.id);toast('Venta registrada. El inventario se actualizó.');return;
    }
    if(form.id==='purchase-form'){
      const items=[...form.querySelectorAll('.purchase-line')].map(line=>({lotId:line.querySelector('[name="lotId"]').value,qty:line.querySelector('[name="qty"]').value,price:line.querySelector('[name="price"]').value}));
      await save('purchase',{...values,items});modal.close();shell();toast('Compra recibida. Las existencias aumentaron.');return;
    }
    if(form.dataset.form){
      const data={...values,id:form.dataset.id||undefined};if(form.dataset.form==='product')data.rx=form.querySelector('[name="rx"]').checked;
      await save(form.dataset.form,data);modal.close();shell();toast('Información guardada correctamente.');
    }
  } catch(error){
    const errorNode=form.querySelector('.form-error');if(errorNode){errorNode.hidden=false;errorNode.textContent=error.message;errorNode.scrollIntoView({block:'nearest'});}else toast(error.message,true);
  } finally {
    pendingForms.delete(form);submitButtons.forEach(button=>button.disabled=false);
  }
});
document.addEventListener('input',event=>{
  if(event.target.matches('[data-search-table]'))filterTable(event.target.value);
  if(event.target.matches('[data-search-catalog]')){
    const query=event.target.value.trim().toLocaleLowerCase('es');document.querySelectorAll('[data-catalog]').forEach(row=>row.hidden=!row.dataset.search.toLocaleLowerCase('es').includes(query));
  }
});
document.addEventListener('change',event=>{
  if(event.target.name==='clientId'&&event.target.closest('#sale-form'))document.querySelector('#sale-recipe').innerHTML=recipeOptions(event.target.value);
});
window.addEventListener('hashchange',()=>{if(actor)navigate(location.hash.slice(1)).catch(e=>toast(e.message,true));});
try{await refresh();await navigate(location.hash.slice(1));}catch{login();}
