import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import defaults from '../../community.json';
const COOKIE = 'rjp_admin';
const TTL = 12 * 60 * 60;
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function response(code, body, extra = {}) { return { statusCode: code, headers: { ...headers, ...extra }, body: JSON.stringify(body) }; }
function digest(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function equal(a, b) { return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
function signature(value, key) { return crypto.createHmac('sha256', key).update('rjp-session:' + value).digest('hex'); }
function authenticated(event, key) {
  const cookie = (event.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  if (!cookie) return false;
  const [expiry, nonce, signed] = cookie.slice(COOKIE.length + 1).split('.');
  return /^\d+$/.test(expiry || '') && Number(expiry) > Date.now() && Number(expiry) <= Date.now() + TTL * 1000 && /^[a-f0-9]{32}$/.test(nonce || '') && equal(signed, signature(expiry + '.' + nonce, key));
}
function cookie(value, age) { return COOKIE + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + age; }
function validate(data) {
  if (!data || typeof data.greeting !== 'string' || typeof data.thanks !== 'string' || typeof data.showGreeting !== 'boolean' || typeof data.showThanks !== 'boolean') return null;
  const clean = { greeting: data.greeting.trim(), thanks: data.thanks.trim(), showGreeting: data.showGreeting, showThanks: data.showThanks };
  if (clean.greeting.length > 280 || clean.thanks.length > 1000 || (clean.showGreeting && !clean.greeting) || (clean.showThanks && !clean.thanks)) return null;
  return clean;
}
async function handle(event) {
  event.headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v]) => [k.toLowerCase(),v]));
  const method = event.httpMethod;
  const privatePassword = process.env.RJP_ADMIN_PASSWORD;
  const key = process.env.RJP_ADMIN_PASSWORD_SHA256 || (typeof privatePassword === 'string' && privatePassword.length >= 16 ? digest(privatePassword) : '');
  const configured = /^[a-f0-9]{64}$/.test(key || '');
  if (method === 'GET' && event.queryStringParameters && event.queryStringParameters.session === '1') return response(configured && authenticated(event,key) ? 200 : 401, { authenticated: configured && authenticated(event,key) });
  if (method !== 'GET') {
    if (!['POST','PUT'].includes(method)) return response(405,{error:'Método no permitido.'});
    try { if (new URL(event.headers.origin).host !== event.headers.host) return response(403,{error:'Origen no permitido.'}); } catch { return response(403,{error:'Origen no permitido.'}); }
    if (!(event.headers['content-type'] || '').startsWith('application/json')) return response(415,{error:'Se requiere JSON.'});
    if (Buffer.byteLength(event.body || '', 'utf8') > 8192) return response(413,{error:'Mensaje demasiado grande.'});
  }
  let input;
  if (method !== 'GET') { try { input = JSON.parse(event.body || '{}'); } catch { return response(400,{error:'Datos inválidos.'}); } }
  if (method !== 'GET' && (!input || typeof input !== 'object' || Array.isArray(input))) return response(400,{error:'Datos inválidos.'});
  if (method === 'POST' && input.action === 'logout') return response(200,{ok:true},{'Set-Cookie':cookie('',0)});
  if (method === 'POST' && input.action === 'login') {
    if (!configured) return response(503,{error:'El acceso privado de administrador aún no está configurado.'});
    if (typeof input.password !== 'string' || input.password.length > 256 || !equal(digest(input.password),key)) return response(401,{error:'Contraseña incorrecta.'});
    const value = String(Date.now() + TTL * 1000) + '.' + crypto.randomBytes(16).toString('hex');
    return response(200,{ok:true},{'Set-Cookie':cookie(value + '.' + signature(value,key),TTL)});
  }
  if (method !== 'GET' && (method !== 'PUT' || !configured || !authenticated(event,key))) return response(401,{error:'Tu sesión terminó. Entra otra vez al panel Admin.'});
  const data = method === 'PUT' ? validate(input.data) : null;
  if (method === 'PUT' && !data) return response(400,{error:'Revisa los textos y sus límites de caracteres.'});
  try {
    const store = getStore({name:'rjp-community',consistency:'strong'});
    const saved = await store.get('published', {type:'json'});
    const current = saved && saved.data || defaults;
    const revision = saved && saved.revision || digest(JSON.stringify(defaults));
    if (method === 'GET') return response(200,{data:current,revision});
    if (input.revision !== revision) return response(409,{error:'Los mensajes cambiaron en otro dispositivo. Recarga antes de publicar.'});
    const next = { data, revision: crypto.randomBytes(16).toString('hex'), updatedAt: new Date().toISOString() };
    await store.setJSON('published',next);
    return response(200,next);
  } catch { return response(503,{error:'No se pudo guardar o cargar el mensaje. Intenta de nuevo.'}); }
};

export default async function (request) {
  const result = await handle({
    httpMethod: request.method,
    headers: { ...Object.fromEntries(request.headers.entries()), host: new URL(request.url).host },
    queryStringParameters: Object.fromEntries(new URL(request.url).searchParams),
    body: request.method === 'GET' ? '' : await request.text()
  });
  return new Response(result.body, {status:result.statusCode,headers:result.headers});
}
