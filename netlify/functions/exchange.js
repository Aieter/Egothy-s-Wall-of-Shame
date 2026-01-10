// Netlify Function: exchange
// Returns USD/TRY current and "yesterday" rates plus an optional startRate.
// Uses a public exchange-rate API (Frankfurter / ECB). Weekends/holidays may return the last business day.
// Caches results for 1 hour to reduce upstream calls.

let cachedData = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

function isoDateUTC(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status} for ${url}`);
  return await res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const now = Date.now();
    if (cachedData && (now - cacheTime) < CACHE_DURATION) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(cachedData) };
    }

    // Frankfurter base is EUR by default; we'll ask for USD base.
    // Latest:
    const latestUrl = "https://api.frankfurter.app/latest?from=USD&to=TRY";
    const latest = await fetchJson(latestUrl);
    const currentRate = latest?.rates?.TRY ?? null;

    // "Yesterday" in UTC (Frankfurter will return previous business day if market closed).
    const y = new Date();
    y.setUTCDate(y.getUTCDate() - 1);
    const yDate = isoDateUTC(y);
    const yesterdayUrl = `https://api.frankfurter.app/${yDate}?from=USD&to=TRY`;
    let yesterdayRate = null;
    try {
      const yd = await fetchJson(yesterdayUrl);
      yesterdayRate = yd?.rates?.TRY ?? null;
    } catch {
      // If the specific date isn't available, keep null.
      yesterdayRate = null;
    }

    // Start rate is mostly a UI baseline; keep as a constant unless you want it configurable.
    // You can set START_RATE in Netlify env vars if you want to change it without redeploying.
    const startRate = Number(process.env.START_RATE || 42.51);

    cachedData = { startRate, currentRate, yesterdayRate, asOf: latest?.date || null };
    cacheTime = now;

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(cachedData) };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
