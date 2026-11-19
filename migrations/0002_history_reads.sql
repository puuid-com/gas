-- Make the history pages read only the rows they show.

-- How many snapshots there are and when the first and latest ran, updated by
-- the snapshot job in the same batch as the snapshot. Pages read this one row
-- instead of counting snapshots, which grows every run.
CREATE TABLE history_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  snapshots INTEGER NOT NULL
);

INSERT INTO history_meta (id, first_at, last_at, snapshots)
SELECT 1, min(at), max(at), count(*) FROM snapshots HAVING count(*) > 0;

-- The region ranking reads one fuel's regions at the latest snapshot. With
-- only the (fuel, region, at) key it read that fuel's whole history; this
-- seeks straight to the snapshot's rows. It carries the ranked columns so the
-- query planner picks it (and needs no lookup) even without table statistics.
-- Queries that name a region keep using the primary key.
CREATE INDEX region_stats_at ON region_stats (fuel, at, median, count, stale);

-- Stale stations are those still in the feed (seen_at = latest snapshot) with
-- old prices. Indexing changed_at alone also read every station that has left
-- the feed; leading with seen_at skips them.
DROP INDEX stations_changed;
CREATE INDEX stations_seen_changed ON stations (seen_at, changed_at);
