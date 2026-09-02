import { config } from "dotenv";
import pkg from "pg";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

config();

const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    await client.connect();
    console.log("Applying migration: unify bugs/errores (source_bug_records.disparador + node_errors.bug_id)...");

    const sql = readFileSync("./migrations/0050_unify_bugs_errores.sql", "utf-8");
    const statements = sql.split("--> statement-breakpoint");

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      await client.query(trimmed);
    }

    console.log("✓ Schema migration completed successfully");

    // Best-effort data migration: node errors cargados directo a un área/proyecto (sin nodo y
    // sin bug vinculado todavía) pasan a ser bugs de esa área/proyecto. No aborta si falla.
    try {
      const { rows } = await client.query(
        `SELECT id, user_id, area_id, project_id, nombre, como_si, points, disparadores, estrategias
           FROM node_errors
          WHERE skill_id IS NULL AND bug_id IS NULL AND (area_id IS NOT NULL OR project_id IS NOT NULL)`
      );
      let migrated = 0;
      for (const err of rows) {
        const bugId = randomUUID();
        const points = Number(err.points) || 0;
        const steps = Math.round(Math.abs(points) / 10);
        const status = points >= 50 ? "debugueado" : steps > 0 ? "debugueando" : "identificado";
        const victoryCount = Math.max(0, Math.round(points / 10));
        await client.query(
          `INSERT INTO source_bugs (id, user_id, area_id, project_id, nombre, status, victory_count, "desc", aparece, disparadores, estrategias)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb, $9::jsonb, $10::jsonb)`,
          [
            bugId,
            err.user_id,
            err.area_id,
            err.project_id,
            err.nombre,
            status,
            victoryCount,
            err.como_si || "",
            JSON.stringify(err.disparadores || []),
            JSON.stringify(err.estrategias || []),
          ]
        );
        // Registros sintéticos para que la barra compartida arranque en el mismo valor.
        const resultado = points > 0 ? "victoria" : "derrota";
        const est = points > 0 ? (err.estrategias || [])[0] || "" : "";
        const dis = points < 0 ? (err.disparadores || [])[0] || "" : "";
        const fecha = new Date().toISOString().slice(0, 10);
        for (let i = 0; i < steps; i++) {
          await client.query(
            `INSERT INTO source_bug_records (id, bug_id, user_id, fecha, situacion, disparador, estrategia, resultado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [randomUUID(), bugId, err.user_id, fecha, err.como_si || err.nombre, dis, est, resultado]
          );
        }
        await client.query(`UPDATE node_errors SET bug_id = $1 WHERE id = $2`, [bugId, err.id]);
        migrated++;
      }
      console.log(`✓ Data migration: ${migrated} node error(s) de área/proyecto convertidos en bugs`);
    } catch (dataError) {
      console.warn("⚠ Data migration skipped:", dataError.message);
    }
  } catch (error) {
    console.error("Error during migration:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
