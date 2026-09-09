import { config } from "dotenv";
import pkg from "pg";

config();

const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Los nodos creados antes del cambio de código quedaron con el título viejo
// "Nodo N" (generado automáticamente al crearlos, no puesto a mano por el
// usuario -- si el usuario le puso un nombre real, el título ya no matchea
// este patrón exacto). Este script los pasa al nuevo standby "Asigná un paso".
const PATTERN = "^Nodo [0-9]+$";

async function run() {
  try {
    await client.connect();

    const preview = await client.query(
      `SELECT id, title FROM skills WHERE title ~ $1`,
      [PATTERN]
    );
    console.log(`Encontrados ${preview.rowCount} nodos con título por defecto viejo.`);

    if (preview.rowCount > 0) {
      const result = await client.query(
        `UPDATE skills SET title = 'Asigná un paso' WHERE title ~ $1`,
        [PATTERN]
      );
      console.log(`✓ Actualizados ${result.rowCount} nodos a "Asigná un paso".`);
    } else {
      console.log("Nada para actualizar.");
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
