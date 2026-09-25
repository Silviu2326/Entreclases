-- Private, versioned state for year-round student tools. Existing browser data is imported on first sync.
create table public.universe_student_state (
 user_id uuid not null references auth.users(id) on delete cascade,
 tool text not null check (tool in ('subjects','notes','learning','exam','grades','calendar','teamwork','libraries')),
 value jsonb not null check (octet_length(value::text) <= 4000000),
 revision integer not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 primary key (user_id, tool)
);
alter table public.universe_student_state enable row level security;
revoke all on public.universe_student_state from public, anon, authenticated;
grant select on public.universe_student_state to authenticated;
create policy student_read_own on public.universe_student_state for select to authenticated using (user_id = (select auth.uid()) and (select public.universe_is_member()));

create function public.universe_student_save(p_tool text, p_value jsonb, p_revision integer default 0) returns integer
language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
 if auth.uid() is null or not public.universe_is_member() then raise exception 'STUDENT_NOT_MEMBER'; end if;
 if p_tool not in ('subjects','notes','learning','exam','grades','calendar','teamwork','libraries') or p_value is null or octet_length(p_value::text)>4000000 or p_revision<0 then raise exception 'STUDENT_INVALID'; end if;
 if p_revision=0 then
  insert into public.universe_student_state(user_id,tool,value) values(auth.uid(),p_tool,p_value)
  on conflict do nothing returning revision into next_revision;
 else
  update public.universe_student_state set value=p_value, revision=revision+1, updated_at=now()
  where user_id=auth.uid() and tool=p_tool and revision=p_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception 'STUDENT_CONFLICT'; end if;
 return next_revision;
end;
$$;
revoke all on function public.universe_student_save(text,jsonb,integer) from public, anon;
grant execute on function public.universe_student_save(text,jsonb,integer) to authenticated;

-- Reuse the account/day limits used by note-study; no model key reaches the client.
create function public.universe_student_ai_claim(p_prepare boolean default false) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.universe_is_member() then raise exception 'STUDENT_NOT_MEMBER'; end if;
 return public.universe_ai_spend(case when p_prepare then 'study' else 'ask' end);
end;
$$;
revoke all on function public.universe_student_ai_claim(boolean) from public, anon;
grant execute on function public.universe_student_ai_claim(boolean) to authenticated;
