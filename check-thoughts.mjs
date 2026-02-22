#!/usr/bin/env node

// Simple check of database STATE without using terminals
import pkg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pkg;

async function main() {
  let client;
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log('DATABASE_URL not set');
      process.exit(1);
    }

    client = new Client({ connectionString: dbUrl });
    await client.connect();

    // List all thoughts
    const thoughts = await client.query('SELECT * FROM journal_thoughts;');
    fs.writeFileSync('thoughts_check.json', JSON.stringify(thoughts.rows, null, 2));
    console.log(`Wrote ${thoughts.rows.length} thoughts to thoughts_check.json`);

    // Count by skillId
    const counts = await client.query(`
      SELECT skill_id, COUNT(*) as count 
      FROM journal_thoughts 
      GROUP BY skill_id
    `);
    console.log('Thoughts by skillId:');
    console.log(counts.rows);

  } catch (err) {
    console.error('Error:', err.message);
    fs.writeFileSync('error.txt', err.message);
  } finally {
    if (client) await client.end();
  }
}

main();
