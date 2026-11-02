
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const PgSession = connectPgSimple(session);

const sessionStore = new PgSession({
  pool,
  schemaName: "velora_sessions",
  tableName: "session",
  createTableIfMissing: false,
  pruneSessionInterval: 900,
});

const isProduction = process.env.NODE_ENV === "production";

export const sessionMiddleware = session({
  store: sessionStore,
  name: "velora.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },

});
