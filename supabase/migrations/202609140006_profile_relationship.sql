-- Store the relationship status selected in the community profile.
alter table public.universe_profiles
  add column relationship_status text not null default 'prefer_not_to_say'
  check (relationship_status in ('single','in_relationship','seeing_someone','complicated','prefer_not_to_say'));

grant update(relationship_status) on public.universe_profiles to authenticated;
