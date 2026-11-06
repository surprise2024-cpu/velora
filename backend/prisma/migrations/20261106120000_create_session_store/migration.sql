
-- Provision PostgreSQL session storage for connect-pg-simple.

CREATE SCHEMA IF NOT EXISTS "velora_sessions";

CREATE TABLE IF NOT EXISTS "velora_sessions"."session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire"
ON "velora_sessions"."session" ("expire");
