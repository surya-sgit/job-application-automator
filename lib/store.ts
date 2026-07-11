import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from 'zod';
import { encrypt, decrypt } from "./crypto";
import { Profile, ProfileSchema, TailoredResumeSchema } from "./resumeSchema";

/**
 * Storage layer with two backends:
 *   - Postgres (Neon), when DATABASE_URL is set — real user accounts
 *     (`users`) plus per-user profile/secrets (`user_data`). This is what
 *     makes accounts and data persist on a serverless host.
 *   - Local JSON files under /data (gitignored) otherwise, for local dev
 *     with zero setup — single-user, no accounts (matches pre-auth behavior).
 *
 * profile.json is plaintext (it's yours); secrets are always AES-encrypted
 * before being written to either backend.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILE_FILE = path.join(DATA_DIR, "profile.json");
const SECRETS_FILE = path.join(DATA_DIR, "secrets.json");

export const USE_DB = !!process.env.DATABASE_URL;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

type Sql = import("@neondatabase/serverless").NeonQueryFunction<false, false>;
let sqlSingleton: Sql | null = null;
let schemaReady: Promise<void> | null = null;

async function db(): Promise<Sql> {
  if (!sqlSingleton) {
    const { neon } = await import("@neondatabase/serverless");
    sqlSingleton = neon(process.env.DATABASE_URL!);
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      await sqlSingleton!`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sqlSingleton!`
        CREATE TABLE IF NOT EXISTS user_data (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, key)
        )
      `;
    })();
  }
  await schemaReady;
  return sqlSingleton;
}

async function kvGet(userId: string, key: string): Promise<string | null> {
  const sql = await db();
  const rows = (await sql`
    SELECT value FROM user_data WHERE user_id = ${userId} AND key = ${key}
  `) as Array<{ value: string }>;
  return rows[0]?.value ?? null;
}

async function kvSet(userId: string, key: string, value: string): Promise<void> {
  const sql = await db();
  await sql`
    INSERT INTO user_data (user_id, key, value, updated_at) VALUES (${userId}, ${key}, ${value}, now())
    ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

// ---------- Users ----------

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
}

export async function createUser(email: string, passwordHash: string): Promise<StoredUser> {
  const sql = await db();
  const id = randomUUID();
  const normalizedEmail = email.trim().toLowerCase();
  await sql`INSERT INTO users (id, email, password_hash) VALUES (${id}, ${normalizedEmail}, ${passwordHash})`;
  return { id, email: normalizedEmail, passwordHash };
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const sql = await db();
  const rows = (await sql`
    SELECT id, email, password_hash FROM users WHERE email = ${email.trim().toLowerCase()}
  `) as Array<{ id: string; email: string; password_hash: string }>;
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, passwordHash: row.password_hash };
}

// ---------- Profile ----------
// `userId` is ignored in file-fallback (single-user, no-DB) mode.

export async function readProfile(userId: string): Promise<Profile> {
  try {
    if (USE_DB) {
      const raw = await kvGet(userId, "profile");
      if (!raw) return ProfileSchema.parse({});
      return ProfileSchema.parse(JSON.parse(raw));
    }
    if (!fs.existsSync(PROFILE_FILE)) return ProfileSchema.parse({});
    const raw = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
    return ProfileSchema.parse(raw);
  } catch {
    return ProfileSchema.parse({});
  }
}

export async function writeProfile(userId: string, profile: Profile): Promise<Profile> {
  const parsed = ProfileSchema.parse(profile);
  if (USE_DB) {
    await kvSet(userId, "profile", JSON.stringify(parsed));
    return parsed;
  }
  ensureDir();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

// ---------- Secrets ----------

export type ProviderName = "anthropic" | "openai" | "google" | "groq" | "ollama";

export interface Secrets {
  provider: ProviderName;
  model: string;
  cheapModel: string; // used by the JD analyzer agent (agent 1)
  keys: {
    anthropic?: string;
    openai?: string;
    google?: string;
    groq?: string;
  };
  ollamaBaseUrl?: string;
  emailProvider?: "gmail" | "outlook";
  gmailUser?: string;
  gmailAppPassword?: string;
  outlookUser?: string;
  outlookAppPassword?: string;
}

const DEFAULT_SECRETS: Secrets = {
  provider: "anthropic",
  model: "claude-opus-4-8",
  cheapModel: "claude-haiku-4-5-20251001",
  keys: {},
  ollamaBaseUrl: "http://localhost:11434",
};

async function readEncryptedSecrets(userId: string): Promise<string | null> {
  if (USE_DB) return kvGet(userId, "secrets");
  if (!fs.existsSync(SECRETS_FILE)) return null;
  return fs.readFileSync(SECRETS_FILE, "utf8");
}

async function writeEncryptedSecrets(userId: string, payload: string): Promise<void> {
  if (USE_DB) {
    await kvSet(userId, "secrets", payload);
    return;
  }
  ensureDir();
  fs.writeFileSync(SECRETS_FILE, payload, "utf8");
}

/** Read secrets, layering env-var fallbacks under anything saved in the UI. */
export async function readSecrets(userId: string): Promise<Secrets> {
  let saved: Partial<Secrets> = {};
  try {
    const enc = await readEncryptedSecrets(userId);
    if (enc) saved = JSON.parse(decrypt(enc)) as Partial<Secrets>;
  } catch {
    saved = {};
  }

  const merged: Secrets = {
    ...DEFAULT_SECRETS,
    ...saved,
    keys: {
      anthropic: saved.keys?.anthropic || process.env.ANTHROPIC_API_KEY || "",
      openai: saved.keys?.openai || process.env.OPENAI_API_KEY || "",
      google: saved.keys?.google || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
      groq: saved.keys?.groq || process.env.GROQ_API_KEY || "",
    },
    ollamaBaseUrl: saved.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    gmailUser: saved.gmailUser || process.env.GMAIL_USER || "",
    gmailAppPassword: saved.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || "",
  };
  return merged;
}

export async function writeSecrets(userId: string, secrets: Secrets): Promise<Secrets> {
  await writeEncryptedSecrets(userId, encrypt(JSON.stringify(secrets)));
  return secrets;
}

/** Redacted view for sending to the browser — never expose raw keys. */
export function redactSecrets(s: Secrets) {
  const mask = (v?: string) => (v ? "•".repeat(8) + v.slice(-4) : "");
  return {
    provider: s.provider,
    model: s.model,
    cheapModel: s.cheapModel,
    ollamaBaseUrl: s.ollamaBaseUrl,
    gmailUser: s.gmailUser,
    keys: {
      anthropic: mask(s.keys.anthropic),
      openai: mask(s.keys.openai),
      google: mask(s.keys.google),
      groq: mask(s.keys.groq),
    },
    gmailAppPasswordSet: !!s.gmailAppPassword,
  };
}

// ---------- Saved Resumes ----------

export interface SavedResume {
  id: string;
  label: string;
  resume: z.infer<typeof TailoredResumeSchema>;
  createdAt: string;
  jdSnippet: string;
}

export async function readResumes(userId: string): Promise<SavedResume[]> {
  try {
    if (USE_DB) {
      const raw = await kvGet(userId, "resumes");
      if (!raw) return [];
      return JSON.parse(raw) as SavedResume[];
    }
    const file = path.join(DATA_DIR, "resumes.json");
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf8")) as SavedResume[];
  } catch {
    return [];
  }
}

export async function writeResumes(userId: string, resumes: SavedResume[]): Promise<void> {
  if (USE_DB) {
    await kvSet(userId, "resumes", JSON.stringify(resumes));
    return;
  }
  ensureDir();
  const file = path.join(DATA_DIR, "resumes.json");
  fs.writeFileSync(file, JSON.stringify(resumes, null, 2), "utf8");
}

export async function deleteResume(userId: string, resumeId: string): Promise<void> {
  const resumes = await readResumes(userId);
  const filtered = resumes.filter((r) => r.id !== resumeId);
  await writeResumes(userId, filtered);
}
