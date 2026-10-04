-- organizations
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- campaigns
create table campaigns (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  public_token text not null unique,
  is_active    boolean not null default true,
  aspect_ratio numeric,          -- set from first frame; null until first upload
  created_at   timestamptz not null default now()
);

-- frames
create table frames (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  label        text not null,
  color_hex    text not null,
  storage_path text not null,
  width        integer not null,
  height       integer not null,
  sort_order   integer not null default 0
);
