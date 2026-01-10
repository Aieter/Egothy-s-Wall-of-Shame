// Netlify Function: exchange
// Returns USD -> TRY current and yesterday rates, plus an optional startRate.
// If caller provides `?start_date=YYYY-MM-DD` the function will attempt to fetch
// the historical rate for that date; otherwise a sensible default is returned.

exports.handler = async (event) => {
  const base = 'USD';
  const symbol = 'TRY';

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
    const latestUrl = `https://api.exchangerate.host/latest?base=${base}&symbols=${symbol}`;
    const latestRes = await safeFetch(latestUrl);
    const latestJson = await latestRes.json();
    const currentRate = latestJson?.rates?.TRY ?? null;

    // yesterday rate
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const yesterdayUrl = `https://api.exchangerate.host/${yesterdayDate}?base=${base}&symbols=${symbol}`;
    const yRes = await safeFetch(yesterdayUrl);
    const yJson = await yRes.json();
    const yesterdayRate = yJson?.rates?.TRY ?? null;

    // startRate: try query param `start_date=YYYY-MM-DD`, otherwise default
    let startRate = 42.51;
    const params = event.queryStringParameters || {};
    if (params.start_date) {
      try {
        const sUrl = `https://api.exchangerate.host/${params.start_date}?base=${base}&symbols=${symbol}`;
        const sRes = await safeFetch(sUrl);
        const sJson = await sRes.json();
        if (sJson?.rates?.TRY) startRate = sJson.rates.TRY;
      } catch (e) {
        // ignore and fall back to default
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startRate, currentRate, yesterdayRate }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
