// Postgres (Neon, added through Vercel Storage). The schema is created on first use, so there is no separate
// migration step to forget. Server-only: never imported by the browser bundle.
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
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
}
