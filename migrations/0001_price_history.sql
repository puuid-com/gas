-- Price history, written by the twice-daily snapshot job (src/server/history.ts).
-- Times are unix seconds of the job run.

-- One row per run.
CREATE TABLE snapshots (
  at INTEGER PRIMARY KEY,
  -- The feed's own timestamp at that run.
  generated_at TEXT NOT NULL,
  station_count INTEGER NOT NULL
);

-- Every station seen so far, with its current prices. changed_at is the run
-- where those prices first appeared: a station whose prices haven't moved in a
-- long time has probably stopped reporting them.
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  -- Lowercase, accent-free name, brand and address for search.
  search TEXT NOT NULL,
  regular REAL,
  super REAL,
  diesel REAL,
  changed_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX stations_changed ON stations (changed_at);

-- A station's prices, written only when they differ from its previous row.
CREATE TABLE price_changes (
  station_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  regular REAL,
  super REAL,
  diesel REAL,
  PRIMARY KEY (station_id, at)
) WITHOUT ROWID;

-- Price spread per fuel and region at each run; region '' is all of Quebec.
CREATE TABLE region_stats (
  fuel TEXT NOT NULL,
  region TEXT NOT NULL,
  at INTEGER NOT NULL,
  count INTEGER NOT NULL,
  min REAL NOT NULL,
  median REAL NOT NULL,
  mean REAL NOT NULL,
  max REAL NOT NULL,
  -- Stations among them whose prices hadn't changed in STALE_DAYS.
  stale INTEGER NOT NULL,
  PRIMARY KEY (fuel, region, at)
) WITHOUT ROWID;
