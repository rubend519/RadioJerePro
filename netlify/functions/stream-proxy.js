/**
 * stream-proxy.js — Radio Jere Pro v3.3
 * Proxy inteligente con Caché de Memoria y Respaldo en Radio Browser
 */

const STATIONS = {
  'co-019': {
    name: 'El Sol Bucaramanga 103.7 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/EL_SOL_BUCARAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/EL_SOL_BUCA_SC',
    ]
  },
  'co-020': {
    name: 'Bésame FM Bucaramanga 104.7 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/BESAME_BUCARAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/BESAME_BUCA_SC',
    ]
  },
  'co-021': {
    name: 'Tropicana Bucaramanga 95.7 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/TR_BUCARAMANGAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/TROPICANA_BUCA_SC',
    ]
  },
  'co-023': {
    name: 'Olímpica Stereo Bucaramanga 97.7 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/OLP_BUCARAMANGAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/OLIMPICA_BUCA_SC',
    ]
  },
  'co-024': {
    name: 'Caracol Radio Bucaramanga',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/CARACOL_BUCARAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/CARACOL_BUCA_SC',
    ]
  },
  'co-025': {
    name: 'La Mega Bucaramanga',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/LA_MEGA_BUCARAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/LA_MEGA_BUCA_SC',
    ]
  },
  'co-026': {
    name: 'La FM Bucaramanga 99.7 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/LA_FM_BUCARAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/LA_FM_BUCA_SC',
    ]
  },
  'co-027': {
    name: 'La Guapachosa 105.1 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/GUAPACHOSA_BUCARAAAC_SC',
    ]
  },
  'co-028': {
    name: 'W Radio Bucaramanga 98.1 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/W_RADIO_BUCARAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/W_RADIO_BUCA_SC',
    ]
  },
  'co-029': {
    name: 'Radio Uno Bucaramanga',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO_UNO_BUCARAAAC_SC',
    ]
  },
  'co-030': {
    name: 'La Kalle Bucaramanga 96.9 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/LA_KALLE_BUCARAAAC_SC',
    ]
  },
  'co-012': {
    name: 'El Sol Bogotá - La Salsa 105.4 FM',
    urls: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/EL_SOL_BOGOTAAAC_SC',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/EL_SOL_BOGOTA_SC',
    ]
  },
};

const resolvedCache = {};
const CACHE_TTL = 15 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Icy-MetaData',
  'Access-Control-Expose-Headers': 'Content-Type, Content-Length, Icy-Name, Icy-Genre',
};

async function resolveCDN(stationId) {
  const stationConfig = STATIONS[stationId];
  if (!stationConfig) return null;

  for (const url of stationConfig.urls) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RadioJerePro/3.3)',
          'Icy-MetaData': '1',
        },
      });
      if (res.ok || res.status === 200) {
        return res.url;
      }
    } catch {}
  }

  const nameQuery = stationConfig.name;
  for (const server of ['de1.api.radio-browser.info', 'nl1.api.radio-browser.info']) {
    try {
      const q = nameQuery.split(' ').slice(0, 3).join(' ');
      const res = await fetch(
        `https://${server}/json/stations/search?name=${encodeURIComponent(q)}&country=Colombia&hidebroken=true&limit=3&order=votes&reverse=true`,
        { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'RadioJerePro/3.3' } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const best = data?.find(s => s.url_resolved || s.url);
      if (best) {
        return best.url_resolved || best.url;
      }
    } catch {}
  }

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const id = event.queryStringParameters?.id;
  if (!id || !STATIONS[id]) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ID de emisora no válido', id }),
    };
  }

  const cached = resolvedCache[id];
  if (cached && (Date.now() - cached.ts < CACHE_TTL)) {
    if (event.queryStringParameters?.info === '1') {
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, url: cached.url, cached: true }) };
    }
    return {
      statusCode: 302,
      headers: { ...CORS, 'Location': cached.url, 'Cache-Control': 'no-cache' },
      body: '',
    };
  }

  try {
    const resolvedUrl = await resolveCDN(id);
    if (!resolvedUrl) {
      return {
        statusCode: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Stream no disponible', id }),
      };
    }

    resolvedCache[id] = { url: resolvedUrl, ts: Date.now() };

    if (event.queryStringParameters?.info === '1') {
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, url: resolvedUrl, cached: false }) };
    }

    return {
      statusCode: 302,
      headers: {
        ...CORS,
        'Location': resolvedUrl,
        'Cache-Control': 'no-cache, no-store',
        'X-Resolved-Station': STATIONS[id].name,
      },
      body: '',
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};