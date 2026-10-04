create or replace function public.get_campaign_by_token(p_token text)
returns json
language plpgsql
security definer   -- runs as the function owner, bypasses RLS for the caller
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'name',   c.name,
    'frames', (
      select json_agg(
        json_build_object(
          'id',          f.id,
          'label',       f.label,
          'color_hex',   f.color_hex,
          'width',       f.width,
          'height',      f.height,
          'storage_path', f.storage_path
        ) order by f.sort_order
      )
      from frames f
      where f.campaign_id = c.id
    )
  )
  into v_result
  from campaigns c
  where c.public_token = p_token
    and c.is_active = true;

  -- Return null for both unknown and inactive tokens (same response, prevents probing)
  return v_result;
end;
$$;

-- Revoke direct table access from anon role; only the function is callable
revoke all on table campaigns from anon;
revoke all on table frames    from anon;
grant execute on function public.get_campaign_by_token(text) to anon;
