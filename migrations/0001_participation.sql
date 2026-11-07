CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  management_hash TEXT NOT NULL UNIQUE,
  reporting_hash TEXT UNIQUE,
  verification_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  last_reported_at TEXT,
  live_confirmed_at TEXT,
  analytics_enabled INTEGER NOT NULL DEFAULT 0 CHECK (analytics_enabled IN (0,1)),
  showcase_permission INTEGER NOT NULL DEFAULT 0 CHECK (showcase_permission IN (0,1)),
  showcase_approved_at TEXT,
  terms_version TEXT NOT NULL,
  permission_updated_at TEXT NOT NULL
);
CREATE TABLE reports (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  impressions INTEGER NOT NULL CHECK (impressions BETWEEN 0 AND 1000000000),
  version TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(site_id,date)
);
CREATE INDEX reports_date ON reports(date);
CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
