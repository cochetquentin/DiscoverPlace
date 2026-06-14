CREATE TABLE trip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Paramètres de la requête
  duration_minutes INTEGER NOT NULL,
  mood TEXT NOT NULL,
  walking TEXT NOT NULL,

  -- Métriques du résultat
  trip_id TEXT,
  success BOOLEAN NOT NULL,
  total_minutes INTEGER,
  transit_minutes INTEGER,
  walking_minutes INTEGER,
  visit_minutes INTEGER,
  stop_count INTEGER,
  score FLOAT,

  -- Stops pour analyse facile
  stops JSONB,

  -- Warnings engine
  warnings TEXT[],

  -- Payloads raw pour debug
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  error_message TEXT
);

CREATE INDEX idx_trip_logs_created_at ON trip_logs(created_at DESC);
CREATE INDEX idx_trip_logs_mood_walking ON trip_logs(mood, walking);
CREATE INDEX idx_trip_logs_success ON trip_logs(success);
