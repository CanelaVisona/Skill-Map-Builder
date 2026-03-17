DO $$ BEGIN
    IF NOT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_skills_progress' 
        AND column_name = 'area_id'
    ) THEN
        ALTER TABLE "user_skills_progress" ADD COLUMN "area_id" varchar;
        ALTER TABLE "user_skills_progress" ADD CONSTRAINT "user_skills_progress_area_id_fk" 
            FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE set null;
    END IF;
END $$;
