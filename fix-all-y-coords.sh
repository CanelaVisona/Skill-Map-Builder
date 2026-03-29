#!/bin/bash

# Array of affected areas
areas=(
  "escribir" "facultad" "finanzas" "intelectual"
  "laburo" "life" "meditacin" "mindset" "msica"
  "programacin" "social" "surf" "viajando"
)

# Function to fix y-coordinates for an area using psql
fix_area() {
  local area_id=$1
  local query="
WITH numbered_skills AS (
  SELECT 
    id,
    level,
    ROW_NUMBER() OVER (PARTITION BY level ORDER BY y) as pos_in_level,
    100 + (level - 1) * 300 + (ROW_NUMBER() OVER (PARTITION BY level ORDER BY y) - 1) * 50 as new_y
  FROM skills
  WHERE area_id = '$area_id'
)
UPDATE skills
SET y = numbered_skills.new_y
FROM numbered_skills
WHERE skills.id = numbered_skills.id;
"
  
  # Use DATABASE_URL to connect
  psql "$DATABASE_URL" -c "$query" && echo "✓ Fixed $area_id"
}

echo "Fixing y-coordinates for all areas..."
for area in "${areas[@]}"; do
  fix_area "$area"
done

echo "✓ All areas fixed!"
