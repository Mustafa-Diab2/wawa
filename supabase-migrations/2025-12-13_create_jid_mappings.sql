-- Create table to map LID JIDs to phone JIDs per session
create table if not exists public.jid_mappings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.whatsapp_sessions (id) on delete cascade,
  lid_jid text not null,
  phone_jid text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (session_id, lid_jid)
);

-- Helpful index for lookup by phone_jid if ever needed
create index if not exists jid_mappings_phone_jid_idx on public.jid_mappings (phone_jid);
