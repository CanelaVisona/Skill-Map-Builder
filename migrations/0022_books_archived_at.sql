ALTER TABLE "books_library" ADD COLUMN "archived_at" timestamp;

CREATE INDEX "books_library_archived_at_idx" ON "books_library"("archived_at");
