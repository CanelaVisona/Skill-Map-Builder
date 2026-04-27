ALTER TABLE space_repetition_practices 
ADD COLUMN lost_intervals text NOT NULL DEFAULT '[]';

COMMENT ON COLUMN space_repetition_practices.lost_intervals IS 'JSON array of interval indices that resulted in loss (rollback). Track which intervals were lost during frozen state for visualization.';
