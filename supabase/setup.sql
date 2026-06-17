-- DiscoverPlace — setup complet Supabase
-- À exécuter dans l'éditeur SQL de Supabase (Settings > SQL Editor)
-- Idempotent : peut être relancé sans risque

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS trip_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Paramètres de la requête
  duration_minutes  INTEGER     NOT NULL,
  mood              TEXT        NOT NULL,
  walking           TEXT        NOT NULL,

  -- Métriques moteur
  anchor_count      INTEGER,
  nearby_count      INTEGER,
  routes_considered INTEGER,

  -- Résultat
  trip_id           TEXT,
  success           BOOLEAN     NOT NULL,
  total_minutes     INTEGER,
  transit_minutes   INTEGER,
  walking_minutes   INTEGER,
  visit_minutes     INTEGER,
  stop_count        INTEGER,
  score             FLOAT,

  -- Résumé des stops pour analyse rapide
  stops             JSONB,
  warnings          TEXT[],

  -- Payloads complets pour debug
  request_payload   JSONB       NOT NULL,
  response_payload  JSONB,
  error_message     TEXT
);

CREATE TABLE IF NOT EXISTS trip_stops (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_log_id           UUID    NOT NULL REFERENCES trip_logs(id) ON DELETE CASCADE,
  position              INTEGER,
  place_name            TEXT,
  place_source          TEXT,
  category              TEXT,
  visit_minutes         INTEGER,
  signal_unusual        FLOAT,
  signal_quality        FLOAT,
  score                 FLOAT,
  walking_from_previous INTEGER
);

-- trip_id est la PK (utilisée pour l'upsert)
CREATE TABLE IF NOT EXISTS trip_feedback (
  trip_id          TEXT        PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT        CHECK (status IN ('completed', 'rejected')),
  mood             TEXT,
  walking          TEXT,
  duration_minutes INTEGER
);

-- Un row par anchor trouvé (même ceux rejetés avant le beam search)
CREATE TABLE IF NOT EXISTS trip_anchors (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_log_id           UUID        NOT NULL REFERENCES trip_logs(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anchor_id             TEXT        NOT NULL,
  anchor_name           TEXT        NOT NULL,
  lat                   FLOAT,
  lng                   FLOAT,
  outbound_minutes      INTEGER,        -- null si non atteignable
  return_minutes        INTEGER,        -- null si non traité (within_transit_limit=false)
  within_transit_limit  BOOLEAN,        -- false = filtré avant beam search
  nearby_count          INTEGER,        -- null si non traité
  routes_built          INTEGER         -- null si non traité
);

-- Un row par lieu retourné par findNearby (toutes ancres confondues)
CREATE TABLE IF NOT EXISTS trip_nearby_places (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_log_id           UUID        NOT NULL REFERENCES trip_logs(id) ON DELETE CASCADE,
  anchor_id             TEXT        NOT NULL,
  place_id              TEXT        NOT NULL,
  place_name            TEXT        NOT NULL,
  category              TEXT,
  lat                   FLOAT,
  lng                   FLOAT,
  signal_unusual        FLOAT,
  signal_quality        FLOAT,
  signal_descriptive    FLOAT,
  signal_chain_penalty  FLOAT,
  was_selected          BOOLEAN     NOT NULL DEFAULT FALSE  -- true si dans la route finale choisie
);

-- Like/dislike explicite, indépendant du feedback completed/rejected
CREATE TABLE IF NOT EXISTS trip_ratings (
  trip_id          TEXT        PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rating           TEXT        NOT NULL CHECK (rating IN ('like', 'dislike')),
  comment          TEXT,                                            -- explication optionnelle
  mood             TEXT,
  walking          TEXT,
  duration_minutes INTEGER
);

-- ============================================================
-- Index
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_trip_logs_created_at        ON trip_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_logs_mood_walking       ON trip_logs(mood, walking);
CREATE INDEX IF NOT EXISTS idx_trip_logs_success            ON trip_logs(success);
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_log_id       ON trip_stops(trip_log_id);
CREATE INDEX IF NOT EXISTS idx_trip_anchors_trip_log_id     ON trip_anchors(trip_log_id);
CREATE INDEX IF NOT EXISTS idx_trip_nearby_trip_log_id      ON trip_nearby_places(trip_log_id);
CREATE INDEX IF NOT EXISTS idx_trip_nearby_was_selected     ON trip_nearby_places(was_selected);

-- ============================================================
-- RLS — désactivé (accès via service_role uniquement)
-- ============================================================

ALTER TABLE trip_logs          DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stops         DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_feedback      DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_anchors       DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_nearby_places DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_ratings       DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Permissions
-- ============================================================

GRANT INSERT, SELECT, DELETE ON trip_logs          TO anon, authenticated, service_role;
GRANT INSERT, SELECT, DELETE ON trip_stops         TO anon, authenticated, service_role;
GRANT INSERT, SELECT, DELETE ON trip_feedback      TO anon, authenticated, service_role;
GRANT INSERT, SELECT, DELETE ON trip_anchors       TO anon, authenticated, service_role;
GRANT INSERT, SELECT, DELETE ON trip_nearby_places TO anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE ON trip_ratings TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
