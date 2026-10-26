// Creates (or updates) the dedicated judge/demo account in Supabase and verifies it can sign in.
// Usage: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// DEMO_USER_EMAIL and DEMO_USER_PASSWORD (e.g. in .env.local), then run `npm run demo-user`.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no extra dependency).
for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service, DEMO_USER_EMAIL: email, DEMO_USER_PASSWORD: password } = process.env;
const missing = Object.entries({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service, DEMO_USER_EMAIL: email, DEMO_USER_PASSWORD: password })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}
if (password.length < 8) {
  console.error("DEMO_USER_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
let userId;
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Hackathon Judge" } });
if (error) {
  if (!/already|registered|exists/i.test(error.message)) throw error;
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw error;
  userId = existing.id;
  await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  console.log(`Updated existing user ${email}`);
} else {
  userId = created.user.id;
  console.log(`Created user ${email}`);
}

// Verify the credentials actually work before telling anyone they do.
const client = createClient(url, anon, { auth: { persistSession: false } });
const { error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error(`Sign-in verification FAILED: ${signInError.message}`);
  process.exit(1);
}
console.log(`Verified: ${email} can sign in (user id ${userId}).`);
console.log("Next: open the app, sign in with the judge button, and click “Load sample DSA course” on Materials.");
