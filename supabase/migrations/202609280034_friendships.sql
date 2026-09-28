-- Amistades. Una fila por pareja: quien la pide queda como `requester_id` y la
-- otra persona la acepta. Solo la pareja ve su fila, y solo se escribe con
-- universe_set_friendship, que decide si pedir, aceptar o deshacer.
create table public.universe_friendships (
 requester_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 addressee_id uuid not null references public.universe_profiles(user_id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 accepted_at timestamptz,
 primary key (requester_id, addressee_id),
 check (requester_id <> addressee_id)
);
-- Una sola fila por pareja, la pida quien la pida.
create unique index universe_friendships_pair on public.universe_friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index universe_friendships_addressee on public.universe_friendships (addressee_id);
revoke all on public.universe_friendships from public, anon, authenticated;
alter table public.universe_friendships enable row level security;
create policy friendships_read on public.universe_friendships for select to authenticated
 using ((select public.universe_is_member()) and (select auth.uid()) in (requester_id, addressee_id));
grant select on public.universe_friendships to authenticated;

-- `befriend` true pide la amistad o acepta la que te han pedido; false la
-- rechaza, la cancela o la deshace. Devuelve el estado que queda.
create function public.universe_set_friendship(peer_uuid uuid, befriend boolean) returns text
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); current_row public.universe_friendships%rowtype;
begin
 if not public.universe_is_member() then raise exception 'UNIVERSE_UNIVERSITY_REQUIRED' using errcode='42501'; end if;
 if peer_uuid is null or peer_uuid=caller
  or not exists(select 1 from public.universe_profiles p where p.user_id=peer_uuid) then raise exception 'PEER_UNAVAILABLE'; end if;
 if not befriend then
  delete from public.universe_friendships f
   where (f.requester_id=caller and f.addressee_id=peer_uuid) or (f.requester_id=peer_uuid and f.addressee_id=caller);
  return 'none';
 end if;
 select * into current_row from public.universe_friendships f
  where (f.requester_id=caller and f.addressee_id=peer_uuid) or (f.requester_id=peer_uuid and f.addressee_id=caller)
  for update;
 if not found then
  insert into public.universe_friendships(requester_id, addressee_id) values (caller, peer_uuid) on conflict do nothing;
  return 'pending';
 end if;
 if current_row.status='pending' and current_row.addressee_id=caller then
  update public.universe_friendships f set status='accepted', accepted_at=now()
   where f.requester_id=current_row.requester_id and f.addressee_id=current_row.addressee_id;
  return 'accepted';
 end if;
 return current_row.status;
end;
$$;
revoke all on function public.universe_set_friendship(uuid, boolean) from public, anon;
grant execute on function public.universe_set_friendship(uuid, boolean) to authenticated;

-- En el escaparate, «contactos» son ahora también tus amigos, además de la gente con la que ya hablas.
create or replace function public.universe_showcase_visible(owner uuid, audience text, viewers uuid[]) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) = owner
  or audience = 'everyone'
  or (audience = 'campus' and exists (
       select 1 from public.universe_profiles a join public.universe_profiles b on a.campus = b.campus
       where a.user_id = owner and b.user_id = (select auth.uid())))
  or (audience = 'contacts' and (exists (
       select 1 from public.universe_threads t
       where (t.user_a = owner and t.user_b = (select auth.uid())) or (t.user_b = owner and t.user_a = (select auth.uid())))
     or exists (
       select 1 from public.universe_friendships f
       where f.status = 'accepted'
         and ((f.requester_id = owner and f.addressee_id = (select auth.uid())) or (f.addressee_id = owner and f.requester_id = (select auth.uid()))))))
  or (audience = 'chosen' and (select auth.uid()) = any(viewers));
$$;
