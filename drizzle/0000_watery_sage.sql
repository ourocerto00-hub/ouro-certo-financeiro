CREATE TABLE `revisions` (
	`revision` integer PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`state` text NOT NULL,
	`actor` text NOT NULL,
	`operation` text NOT NULL,
	`created_at` text NOT NULL,
	`justification` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revisions_request_id_unique` ON `revisions` (`request_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','financeiro')), salt TEXT NOT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id), expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
