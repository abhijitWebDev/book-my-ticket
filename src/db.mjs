import pg from "pg";

const url = new URL(process.env.DATABASE_URL);

const pool = new pg.Pool({
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  user: url.username,
  password: String(url.password) || "",   // pg SCRAM requires a string, never undefined
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
  max: 20,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,  // release idle connections after 30s (Neon kills them after ~5 min)
});

// Prevent idle connection drops from crashing the process
pool.on("error", (err) => {
  console.error("Unexpected pool client error:", err.message);
});

export default pool;
