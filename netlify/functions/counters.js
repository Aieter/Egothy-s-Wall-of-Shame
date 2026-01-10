const { neon } = require("@netlify/neon");

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

async function ensureSetup() {
  if (!sql) return; // Skip if no database connection
  
  await sql`
    CREATE TABLE IF NOT EXISTS counters (
      id INTEGER PRIMARY KEY,
      wins INTEGER NOT NULL,
      prayers INTEGER NOT NULL,
      hagels INTEGER NOT NULL
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

exports.handler = async function (event) {
  try {
    await ensureSetup();

    if (event.httpMethod === "POST") {
      if (!sql) return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) };
      
      const action = event.queryStringParameters?.action;

      if (action === "pray") {
        await sql`UPDATE counters SET prayers = prayers + 1 WHERE id = 1`;
      }

      if (action === "hagelslag") {
        await sql`UPDATE counters SET hagels = hagels + 1 WHERE id = 1`;
      }

      if (action === "win") {
        await sql`UPDATE counters SET wins = wins + 1 WHERE id = 1`;
      }

      if (action === "unwin") {
        await sql`
          UPDATE counters
          SET wins = GREATEST(wins - 1, 0)
          WHERE id = 1
        `;
      }
    }

    if (sql) {
      const [row] = await sql`
        SELECT wins, prayers, hagels FROM counters WHERE id = 1
      `;
      
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ ...row, hagelslags: row.hagels })
      };
    } else {
      // Return fallback values when database is not configured
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ wins: 20, prayers: 1337, hagels: 69, hagelslags: 69 })
      };
    }
  } catch (err) {
    // Return fallback values on any error
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ wins: 20, prayers: 1337, hagels: 69, hagelslags: 69 })
    };
  }
};
