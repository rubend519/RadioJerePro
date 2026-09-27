/**
 * sync.js — Radio Jere Pro
 * Sincroniza configuración (favoritos, ancladas, tema) entre dispositivos
 * mediante un código corto de 9 dígitos, sin necesitar cuentas de usuario.
 *
 * POST  /sync   { ...config }        -> { code: "123456789" }
 * GET   /sync?code=123456789         -> { data: {...config} }
 *
 * El código expira solo a los 15 minutos, y se borra en cuanto se usa una
 * vez (uso único) — nadie más puede reutilizarlo después de importarlo.
 */

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const TTL_MS = 15 * 60 * 1000; // 15 minutos
const MAX_BYTES = 100 * 1024;  // 100 KB, de sobra para favoritos/tema

function randomCode9() {
  let code = '';
  for (let i = 0; i < 9; i++) code += Math.floor(Math.random() * 10);
  return code;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const store = getStore('rjp-sync');

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'JSON inválido' }),
      };
    }

    const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (size > MAX_BYTES) {
      return {
        statusCode: 413,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Configuración demasiado grande' }),
      };
    }

    let code = randomCode9();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await store.get(code);
      if (!existing) break;
      code = randomCode9();
    }

    await store.setJSON(code, { data: payload, expires: Date.now() + TTL_MS });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    };
  }

  if (event.httpMethod === 'GET') {
    const code = ((event.queryStringParameters && event.queryStringParameters.code) || '').trim();
    if (!/^\d{9}$/.test(code)) {
      return {
        statusCode: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Código inválido, deben ser 9 dígitos' }),
      };
    }

    const entry = await store.get(code, { type: 'json' });
    if (!entry || Date.now() > entry.expires) {
      if (entry) await store.delete(code);
      return {
        statusCode: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Código expirado o no existe' }),
      };
    }

    await store.delete(code); // uso único

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: entry.data }),
    };
  }

  return { statusCode: 405, headers: CORS, body: 'Method not allowed' };
};
