// Netlify Function: exchange
// Returns USD -> TRY current and yesterday rates, plus an optional startRate.
// Uses exchangerate-api.com with API key for better reliability.
// Caches results for 1 hour to minimize API calls.

let cachedData = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

exports.handler = async (event) => {
  const now = Date.now();
  
  // Return cached data if it's still fresh
  if (cachedData && (now - cacheTime) < CACHE_DURATION) {
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(cachedData),
    };
  }

  const apiKey = process.env.ERATE_API_KEY;
  if (!apiKey) {
    // Return fallback values when API key is not configured
    cachedData = { startRate: 32.0, currentRate: null, yesterdayRate: null };
    cacheTime = now;
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(cachedData),
    };
  }

  // helper: safe fetch supporting environments without global fetch
  async function safeFetch(url) {
    if (typeof fetch === 'function') {
      return fetch(url);
    }
    // dynamic import node-fetch as fallback
    const nodeFetch = (await import('node-fetch')).default;
    return nodeFetch(url);
  }

  try {
    // current rate
    const latestUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
    const latestRes = await safeFetch(latestUrl);
    const latestJson = await latestRes.json();
    
    if (latestJson.result !== 'success') {
      throw new Error(`API Error: ${latestJson['error-type']}`);
    }
    
    const currentRate = latestJson.conversion_rates.TRY;

    // yesterday rate - use historical endpoint
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const yesterdayUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/history/USD/${yesterdayDate}`;
    const yRes = await safeFetch(yesterdayUrl);
    const yJson = await yRes.json();
    
    let yesterdayRate = null;
    if (yJson.result === 'success') {
      yesterdayRate = yJson.conversion_rates.TRY;
    }

    // startRate: try query param `start_date=YYYY-MM-DD`, otherwise default
    let startRate = 42.51;
    const params = event.queryStringParameters || {};
    if (params.start_date) {
      try {
        const sUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/history/USD/${params.start_date}`;
        const sRes = await safeFetch(sUrl);
        const sJson = await sRes.json();
        if (sJson.result === 'success' && sJson.conversion_rates.TRY) {
          startRate = sJson.conversion_rates.TRY;
        }
      } catch (e) {
        // ignore and fall back to default
      }
    }

    cachedData = { startRate, currentRate, yesterdayRate };
    cacheTime = now;

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(cachedData),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
