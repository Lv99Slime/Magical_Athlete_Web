-- Run with an administrative connection. Browser roles cannot read canonical state.
create table if not exists public.game_rooms (
 id uuid primary key default gen_random_uuid(), code text unique not null check (code ~ '^[A-Z0-9]{6}$'),
 version integer not null default 0, state jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.game_members (
 room_id uuid references public.game_rooms on delete cascade, user_id uuid not null references auth.users,
 player_id text not null, primary key(room_id,user_id), unique(room_id,player_id)
);
create table if not exists public.game_commands (
 user_id uuid not null, command_id uuid not null, room_id uuid not null references public.game_rooms on delete cascade,
 digest text not null, version integer not null, events jsonb not null default '[]', action jsonb, random_outcomes jsonb not null default '[]',
 created_at timestamptz not null default now(), primary key(user_id,command_id)
);
alter table public.game_rooms enable row level security;
alter table public.game_members enable row level security;
alter table public.game_commands enable row level security;
revoke all on public.game_rooms, public.game_members, public.game_commands from anon, authenticated;
grant all on public.game_rooms, public.game_members, public.game_commands to service_role;

create or replace function public.game_create(p_user uuid,p_command uuid,p_digest text,p_code text,p_name text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare rid uuid; old_digest text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select room_id,digest into rid,old_digest from public.game_commands where user_id=p_user and command_id=p_command;
 if found then
  if old_digest<>p_digest then raise exception 'COMMAND_REUSED'; end if;
  return rid;
 end if;
 insert into public.game_rooms(code,state) values(p_code,jsonb_build_object('hostId','p0','members',jsonb_build_array(jsonb_build_object('id','p0','name',p_name,'ready',false)),'game',null)) returning id into rid;
 insert into public.game_members values(rid,p_user,'p0');
 insert into public.game_commands(user_id,command_id,room_id,digest,version) values(p_user,p_command,rid,p_digest,0);
 return rid;
end $$;

create or replace function public.game_join(p_user uuid,p_command uuid,p_digest text,p_code text,p_name text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare r public.game_rooms; pid text; old_digest text; rid uuid; count_members integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select room_id,digest into rid,old_digest from public.game_commands where user_id=p_user and command_id=p_command;
 if found then
  if old_digest<>p_digest then raise exception 'COMMAND_REUSED'; end if;
  return rid;
 end if;
 select * into r from public.game_rooms where code=p_code for update;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select player_id into pid from public.game_members where room_id=r.id and user_id=p_user;
 if not found then
  if r.state->'game'<>'null'::jsonb then raise exception 'GAME_STARTED'; end if;
  count_members:=jsonb_array_length(r.state->'members');
  if count_members>=6 then raise exception 'ROOM_FULL'; end if;
  pid:='p'||count_members;
  insert into public.game_members values(r.id,p_user,pid);
  update public.game_rooms set state=jsonb_set(state,'{members}',(state->'members')||jsonb_build_array(jsonb_build_object('id',pid,'name',p_name,'ready',false))),version=version+1,updated_at=now() where id=r.id returning * into r;
  perform realtime.send(jsonb_build_object('roomId',r.id,'version',r.version),'changed','room:'||r.id,true);
 end if;
 insert into public.game_commands(user_id,command_id,room_id,digest,version) values(p_user,p_command,r.id,p_digest,r.version);
 return r.id;
end $$;

create or replace function public.game_commit(p_user uuid,p_command uuid,p_digest text,p_room uuid,p_expected integer,p_state jsonb,p_events jsonb,p_action jsonb,p_random jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare r public.game_rooms; receipt public.game_commands;
begin
 select * into r from public.game_rooms where id=p_room for update;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 if not exists(select 1 from public.game_members where room_id=p_room and user_id=p_user) then raise exception 'NOT_MEMBER'; end if;
 select * into receipt from public.game_commands where user_id=p_user and command_id=p_command;
 if found then
  if receipt.digest<>p_digest or receipt.room_id<>p_room then raise exception 'COMMAND_REUSED'; end if;
  return receipt.version;
 end if;
 if r.version<>p_expected then raise exception 'STALE_STATE'; end if;
 update public.game_rooms set state=p_state, version=version+1, updated_at=now() where id=p_room;
 insert into public.game_commands(user_id,command_id,room_id,digest,version,events,action,random_outcomes) values(p_user,p_command,p_room,p_digest,p_expected+1,p_events,p_action,p_random);
 perform realtime.send(jsonb_build_object('roomId',p_room,'version',p_expected+1),'changed','room:'||p_room,true);
 return p_expected+1;
end $$;

-- Realtime uses this narrow membership helper; it reveals only the caller's membership.
create or replace function public.game_is_member(topic text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.game_members where user_id=(select auth.uid()) and 'room:'||room_id=topic)
$$;
revoke all on function public.game_create(uuid,uuid,text,text,text), public.game_join(uuid,uuid,text,text,text), public.game_commit(uuid,uuid,text,uuid,integer,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.game_create(uuid,uuid,text,text,text), public.game_join(uuid,uuid,text,text,text), public.game_commit(uuid,uuid,text,uuid,integer,jsonb,jsonb,jsonb,jsonb) to service_role;
revoke all on function public.game_is_member(text) from public,anon;
grant execute on function public.game_is_member(text) to authenticated;
drop policy if exists game_room_receive on realtime.messages;
create policy game_room_receive on realtime.messages for select to authenticated using (extension='broadcast' and public.game_is_member(realtime.topic()));

create table if not exists public.game_rate_limits (
 user_id uuid not null, bucket text not null, window_start timestamptz not null, count integer not null,
 primary key(user_id,bucket)
);
alter table public.game_rate_limits enable row level security;
revoke all on public.game_rate_limits from anon,authenticated;
grant all on public.game_rate_limits to service_role;
create or replace function public.game_check_rate(p_user uuid,p_bucket text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer; span interval; ceiling integer;
begin
 span:=case when p_bucket='create' then interval '1 hour' else interval '1 minute' end;
 ceiling:=case when p_bucket='create' then 12 else 120 end;
 insert into public.game_rate_limits(user_id,bucket,window_start,count) values(p_user,p_bucket,now(),1)
 on conflict(user_id,bucket) do update set
 count=case when public.game_rate_limits.window_start<now()-span then 1 else public.game_rate_limits.count+1 end,
 window_start=case when public.game_rate_limits.window_start<now()-span then now() else public.game_rate_limits.window_start end
 returning count into n;
 return n<=ceiling;
end $$;
revoke all on function public.game_check_rate(uuid,text) from public,anon,authenticated;
grant execute on function public.game_check_rate(uuid,text) to service_role;
