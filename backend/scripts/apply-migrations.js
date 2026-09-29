'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

async function main() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log(`No migrations found in ${MIGRATIONS_DIR}`);
    return;
  }

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }
  console.log(`Applied ${files.length} migration(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
