-- Enable RLS
alter table organizations enable row level security;
alter table campaigns    enable row level security;
alter table frames       enable row level security;

-- organizations: owner only
create policy "org owner select" on organizations for select using (owner_id = auth.uid());
create policy "org owner insert" on organizations for insert with check (owner_id = auth.uid());
create policy "org owner update" on organizations for update using (owner_id = auth.uid());
create policy "org owner delete" on organizations for delete using (owner_id = auth.uid());

-- campaigns: admin owns the parent org
create policy "campaign owner select" on campaigns for select
  using (org_id in (select id from organizations where owner_id = auth.uid()));
create policy "campaign owner insert" on campaigns for insert
  with check (org_id in (select id from organizations where owner_id = auth.uid()));
create policy "campaign owner update" on campaigns for update
  using (org_id in (select id from organizations where owner_id = auth.uid()));
create policy "campaign owner delete" on campaigns for delete
  using (org_id in (select id from organizations where owner_id = auth.uid()));

-- frames: admin owns the campaign's org
create policy "frame owner select" on frames for select
  using (campaign_id in (
    select c.id from campaigns c
    join organizations o on o.id = c.org_id
    where o.owner_id = auth.uid()
  ));
create policy "frame owner insert" on frames for insert
  with check (campaign_id in (
    select c.id from campaigns c
    join organizations o on o.id = c.org_id
    where o.owner_id = auth.uid()
  ));
create policy "frame owner update" on frames for update
  using (campaign_id in (
    select c.id from campaigns c
    join organizations o on o.id = c.org_id
    where o.owner_id = auth.uid()
  ));
create policy "frame owner delete" on frames for delete
  using (campaign_id in (
    select c.id from campaigns c
    join organizations o on o.id = c.org_id
    where o.owner_id = auth.uid()
  ));

-- Storage bucket policies (run in Supabase Storage UI or via CLI):
-- Bucket: "frames", public: true
-- Upload policy: bucket_id = 'frames' AND (storage.foldername(name))[1] = auth.uid()::text
-- Delete policy: same as upload
