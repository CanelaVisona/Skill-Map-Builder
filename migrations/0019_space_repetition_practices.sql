CREATE TABLE IF NOT EXISTS space_repetition_practices (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  start_date VARCHAR(10) NOT NULL,
  completed_intervals JSONB NOT NULL DEFAULT '[]',
  archived INTEGER DEFAULT 0,
  end_date VARCHAR(10),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_space_rep_user_id ON space_repetition_practices(user_id);
CREATE INDEX idx_space_rep_archived ON space_repetition_practices(archived);
