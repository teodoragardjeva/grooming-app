// Creates (or resets the password of) an admin account. There is no public registration.
//
//   docker compose run --rm -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='long passphrase' app node scripts/create-admin.mjs
//
// Locally (with DATABASE_URL set): ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/create-admin.mjs
// The hash format matches src/lib/security/password.ts (scrypt$N$r$p$salt$hash).
import { randomBytes, scrypt } from "node:crypto";
import pg from "pg";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("ADMIN_EMAIL is missing or not a valid e-mail address.");
if (password.length < 12) fail("ADMIN_PASSWORD must be at least 12 characters.");
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set.");

const N = 16384, R = 8, P = 1;
const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scrypt(password.normalize("NFKC"), salt, 64, { N, r: R, p: P, maxmem: 128 * N * R * 2 }, (e, k) => (e ? reject(e) : resolve(k))),
);
const hash = `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `insert into public.admin_profiles (email, password_hash) values ($1, $2)
     on conflict ((lower(email))) do update set password_hash = excluded.password_hash`,
    [email, hash],
  );
  // A password reset signs the account out everywhere.
  await client.query(`delete from public.admin_sessions where user_id = (select user_id from public.admin_profiles where lower(email) = $1)`, [email]);
  console.log(`Admin account ready: ${email}`);
} finally {
  await client.end();
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
