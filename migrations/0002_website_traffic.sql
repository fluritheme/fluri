CREATE TABLE website_daily (
  date TEXT NOT NULL,
  path TEXT NOT NULL,
  source TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (date, path, source)
);

CREATE TABLE website_analytics_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  started_at TEXT NOT NULL
);
