import "dotenv/config";
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const tables = await client.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
  const migrations = await client.query<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; logs: string | null }>(
    "SELECT migration_name, finished_at, rolled_back_at, logs FROM public._prisma_migrations ORDER BY started_at",
  );
  const userRoles = await client.query<{ role: string; count: string }>(
    'SELECT "role"::text AS role, count(*)::text AS count FROM public."User" GROUP BY "role" ORDER BY "role"',
  );
  const counts: { table: string; rows: number }[] = [];
  for (const { table_name } of tables.rows) {
    const identifier = `"${table_name.replaceAll('"', '""')}"`;
    const count = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM public.${identifier}`);
    counts.push({ table: table_name, rows: Number(count.rows[0]?.count ?? 0) });
  }
  console.log(JSON.stringify({ database: "neondb", schema: "public", userRoles: userRoles.rows, migrations: migrations.rows, tables: counts }, null, 2));
} finally { await client.end(); }
