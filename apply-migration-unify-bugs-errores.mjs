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

    // Data migration: TODO node error que todavía no tenga bug vinculado pasa a ser un bug (los
    // "bugs" que se veían en la tab del Journal antes eran estos node errors). Para los de un
    // nodo puntual, el área/proyecto se toma del skill. Reejecutable (WHERE bug_id IS NULL).
    try {
      const { rows } = await client.query(
        `SELECT ne.id, ne.user_id, ne.nombre, ne.como_si, ne.points, ne.disparadores, ne.estrategias,
                COALESCE(ne.area_id, s.area_id)       AS area_id,
                COALESCE(ne.project_id, s.project_id) AS project_id
           FROM node_errors ne
           LEFT JOIN skills s ON s.id = ne.skill_id
          WHERE ne.bug_id IS NULL`
      );
      let migrated = 0;
      let skipped = 0;
      for (const err of rows) {
        if (!err.area_id && !err.project_id) { skipped++; continue; }
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
      console.log(`✓ Data migration: ${migrated} node error(s) convertidos en bugs${skipped ? ` (${skipped} sin área/proyecto, omitidos)` : ""}`);
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
