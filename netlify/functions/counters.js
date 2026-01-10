const { neon } = require("@netlify/neon");

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

// Netlify DB (powered by Neon) typically provides NETLIFY_DATABASE_URL.
// Fall back to DATABASE_URL if you set your own.
const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || "";
const sql = dbUrl ? neon(dbUrl) : null;

async function ensureSetup() {
  if (!sql) return;

  await sql`
    CREATE TABLE IF NOT EXISTS counters (
      id INTEGER PRIMARY KEY,
      wins INTEGER NOT NULL DEFAULT 0,
      prayers INTEGER NOT NULL DEFAULT 0,
      hagels INTEGER NOT NULL DEFAULT 0
    )
  `;

  const rows = await sql`SELECT id FROM counters WHERE id = 1`;
  if (rows.length === 0) {
    await sql`
      INSERT INTO counters (id, wins, prayers, hagels)
      VALUES (1, 0, 0, 0)
    `;
  }
}

async function getRow() {
  if (!sql) return { wins: 0, prayers: 0, hagels: 0, hagelslags: 0 };

  const [row] = await sql`SELECT wins, prayers, hagels FROM counters WHERE id = 1`;
  return { ...row, hagelslags: row.hagels };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    await ensureSetup();

    if (event.httpMethod === "POST") {
      if (!sql) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Database not configured. Set NETLIFY_DATABASE_URL (Netlify DB) or DATABASE_URL.",
            wins: 0,
            prayers: 0,
            hagels: 0,
            hagelslags: 0,
          }),
        };
      }

      const action = event.queryStringParameters?.action;

      if (action === "pray") {
        await sql`UPDATE counters SET prayers = prayers + 1 WHERE id = 1`;
      } else if (action === "hagelslag") {
        await sql`UPDATE counters SET hagels = hagels + 1 WHERE id = 1`;
      } else if (action === "win") {
        await sql`UPDATE counters SET wins = wins + 1 WHERE id = 1`;
      } else if (action === "unwin") {
        await sql`UPDATE counters SET wins = GREATEST(wins - 1, 0) WHERE id = 1`;
      } else {
        // Unknown action: ignore, but still return current values
      }
    }

    const row = await getRow();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(row),
    };
  } catch (err) {
    // Fail loudly so you notice in Netlify function logs, but keep the UI stable with zeros.
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: String(err),
        wins: 0,
        prayers: 0,
        hagels: 0,
        hagelslags: 0,
      }),
    };
  }
};
