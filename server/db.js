// Postgres (Neon, added through Vercel Storage). The schema is created on first use, so there is no separate
// migration step to forget. Server-only: never imported by the browser bundle.
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL
export const hasDb = () => !!url
let sql = null, ready = null

export function db() {
  if (!url) throw Object.assign(new Error('Database not configured'), { status: 503 })
  sql ||= neon(url)
  ready ||= migrate(sql)
  return ready.then(() => sql)
}

async function migrate(q) {
  await q`create table if not exists rent_reports (
    id bigserial primary key,
    area_id text not null,
    room text not null,
    rent integer not null check (rent between 250 and 4000),
    bills text not null check (bills in ('no','yes','some')),
    since text,
    ip_hash text not null,
    created_at timestamptz not null default now()
  )`
  await q`create index if not exists rent_reports_area on rent_reports (area_id, room)`
  await q`create index if not exists rent_reports_ip on rent_reports (ip_hash, created_at)`
  await q`create table if not exists feedback (
    id bigserial primary key,
    kind text not null,
    message text not null check (length(message) between 3 and 2000),
    page text,
    ip_hash text not null,
    created_at timestamptz not null default now()
  )`
  await q`create table if not exists reliability (
    observed_at timestamptz not null,
    route_id text not null,
    trips integer not null,
    late5 integer not null,
    late10 integer not null,
    early integer not null,
    sum_delay integer not null,
    primary key (observed_at, route_id)
  )`
  // A single-row shared cache of the compacted NTA live feed, so every serverless instance isn't
  // independently hitting NTA's rate-limited upstream (observed directly: a 429 during testing
  // with only a handful of manual requests). pg_try_advisory_lock in live.js dedupes concurrent
  // refreshes across instances; this table is what they share the result through.
  await q`create table if not exists live_cache (
    id smallint primary key,
    payload jsonb not null,
    feed_updated_at timestamptz,
    fetched_at timestamptz not null
  )`
  // Accounts are entirely optional: no personal info, just a username and a password. Used only
  // so someone can keep a saved-areas list across devices if they want to; nothing requires one.
  await q`create table if not exists users (
    id bigserial primary key,
    username text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now()
  )`
  await q`create table if not exists sessions (
    token text primary key,
    user_id bigint not null references users(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
  )`
  await q`create index if not exists sessions_user on sessions (user_id)`
  await q`create table if not exists saved_areas (
    user_id bigint not null references users(id) on delete cascade,
    area_id text not null,
    created_at timestamptz not null default now(),
    primary key (user_id, area_id)
  )`
  await q`create table if not exists auth_attempts (
    id bigserial primary key,
    ip_hash text not null,
    kind text not null,
    created_at timestamptz not null default now()
  )`
  await q`create index if not exists auth_attempts_ip on auth_attempts (ip_hash, kind, created_at)`
}
