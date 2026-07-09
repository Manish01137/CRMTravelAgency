/**
 * Creates/updates the restricted `crm_app` runtime role and its grants by
 * executing prisma/rls/roles.sql over the privileged DATABASE_URL connection.
 *
 *   npm run db:roles
 *
 * The role password comes from CRM_APP_DB_PASSWORD and MUST match the password
 * embedded in APP_DATABASE_URL. No psql required — runs via `pg`.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — copy backend/.env.example to backend/.env first.');
  }

  const password = process.env.CRM_APP_DB_PASSWORD ?? 'crm_app_pw';
  if (!process.env.CRM_APP_DB_PASSWORD) {
    console.warn('⚠  CRM_APP_DB_PASSWORD not set — using default "crm_app_pw". Set a strong one in .env.');
  }

  // Escape single quotes for safe embedding in the CREATE/ALTER ROLE literal.
  const safePassword = password.replace(/'/g, "''");

  const sqlPath = join(__dirname, 'roles.sql');
  const sql = readFileSync(sqlPath, 'utf8').replaceAll('__CRM_APP_PASSWORD__', safePassword);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✓ crm_app role created/updated and granted (RLS enforced for this role).');
    console.log('  Make sure APP_DATABASE_URL uses user "crm_app" with this password.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('✗ Failed to apply roles:', err instanceof Error ? err.message : err);
  process.exit(1);
});
