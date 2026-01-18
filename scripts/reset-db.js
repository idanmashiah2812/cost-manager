#!/usr/bin/env node

/**
 * Reset DB to the state required by the submission guidelines:
 * - Database should be empty, except for a single imaginary user:
 *   id: 123123, first_name: "mosh", last_name: "israeli"
 *
 * IMPORTANT:
 * - The course spec also requires a `birthday` field for users, so we insert a
 *   default birthday as well (you can change it).
 * - This script deletes ALL documents from: users, costs, logs, reports.
 *
 * Usage:
 *   node scripts/reset-db.js --env services/users-service/.env
 *
 * If --env is omitted, it tries to load:
 *   1) process.env.MONGODB_URI (already set)
 *   2) services/users-service/.env
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env') out.env = argv[++i];
  }
  return out;
}

function tryLoadDotenv(dotenvPath) {
  try {
    // eslint-disable-next-line global-require
    const dotenv = require('dotenv');
    if (fs.existsSync(dotenvPath)) {
      dotenv.config({ path: dotenvPath });
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const envPath = args.env
    ? path.resolve(process.cwd(), args.env)
    : path.resolve(process.cwd(), 'services/users-service/.env');

  // Load env if MONGODB_URI isn't already present
  if (!process.env.MONGODB_URI) {
    const ok = tryLoadDotenv(envPath);
    if (!ok) {
      console.error(`Could not load .env from: ${envPath}`);
    }
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is missing. Provide it in .env or environment variables.');
    process.exit(1);
  }

  const dbName = process.env.MONGODB_DB || undefined;
  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db;

  const collections = ['users', 'costs', 'logs', 'reports'];
  for (const c of collections) {
    try {
      await db.collection(c).deleteMany({});
      // eslint-disable-next-line no-console
      console.log(`Cleared collection: ${c}`);
    } catch (e) {
      // Collection may not exist yet, that's fine.
      // eslint-disable-next-line no-console
      console.log(`Skipped clearing (missing?) collection: ${c}`);
    }
  }

  // Ensure the unique index for `users.id` exists (safe if it already exists)
  try {
    await db.collection('users').createIndex({ id: 1 }, { unique: true });
  } catch (e) {
    // ignore
  }

  const imaginaryUser = {
    id: 123123,
    first_name: 'mosh',
    last_name: 'israeli',
    birthday: new Date('1990-01-01')
  };

  await db.collection('users').insertOne(imaginaryUser);
  // eslint-disable-next-line no-console
  console.log('Inserted imaginary user:', { id: imaginaryUser.id, first_name: imaginaryUser.first_name, last_name: imaginaryUser.last_name });

  await mongoose.disconnect();
  // eslint-disable-next-line no-console
  console.log('DB reset complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
