CREATE TABLE app_config (id TEXT PRIMARY KEY, value TEXT NOT NULL, revision INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE collection_archives (product_id TEXT PRIMARY KEY, archived INTEGER NOT NULL CHECK (archived IN (0,1)));
--> statement-breakpoint
CREATE TABLE operator_sessions (token_hash TEXT PRIMARY KEY, session_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE demo_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT UNIQUE NOT NULL, input TEXT NOT NULL, value TEXT NOT NULL, type TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE demo_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('design','personalization')),
  request_key TEXT UNIQUE NOT NULL, input_json TEXT NOT NULL, session_id TEXT,
  status TEXT NOT NULL, stage TEXT NOT NULL, value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0, lock_token TEXT, lock_until INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS generation_status ON generation_jobs(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS generation_owner ON generation_jobs(session_id,kind);
