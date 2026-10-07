-- Role separation and context-aware notes.
-- Applied to production Supabase as migration role_defaults_context_notes.

create or replace function public.can_read_audience_global(p_audience public.audience_type)
returns boolean
language sql
stable security definer
set search_path=''
set row_security='off'
as $$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when exists(select 1 from public.user_audience_scopes s where s.user_id=public.current_app_user_id() and s.audience=p_audience)
      then coalesce((select s.can_read from public.user_audience_scopes s where s.user_id=public.current_app_user_id() and s.audience=p_audience limit 1),false)
    when exists(select 1 from public.user_audience_scopes s where s.user_id=public.current_app_user_id()) then false
    else case public.current_app_role()
      when 'DEWAN_GURU'::public.app_role then false
      when 'KELOMPOK'::public.app_role then p_audience in ('KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS')
      when 'VIEWER'::public.app_role then p_audience in ('KELOMPOK','MUDA_MUDI','CABERAWIT','IBU_IBU')
      else false
    end
  end
$$;

create or replace function public.can_write_audience_global(p_audience public.audience_type)
returns boolean
language sql
stable security definer
set search_path=''
set row_security='off'
as $$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when exists(select 1 from public.user_audience_scopes s where s.user_id=public.current_app_user_id() and s.audience=p_audience)
      then coalesce((select s.can_write from public.user_audience_scopes s where s.user_id=public.current_app_user_id() and s.audience=p_audience limit 1),false)
    when exists(select 1 from public.user_audience_scopes s where s.user_id=public.current_app_user_id()) then false
    else case public.current_app_role()
      when 'DEWAN_GURU'::public.app_role then false
      when 'KELOMPOK'::public.app_role then p_audience in ('KELOMPOK','IBU_IBU','PENGURUS')
      else false
    end
  end
$$;

alter table public.personal_notes add column if not exists context_type text not null default 'PERSONAL';
alter table public.personal_notes add column if not exists visibility text not null default 'PRIVATE';
alter table public.personal_notes add column if not exists audience public.audience_type;
alter table public.personal_notes add column if not exists class_id uuid references public.classes(id) on delete set null;
alter table public.personal_notes add column if not exists member_id uuid references public.members(id) on delete set null;
alter table public.personal_notes add column if not exists attendance_event_id uuid references public.attendance_events(id) on delete set null;
alter table public.personal_notes add column if not exists agenda_id uuid references public.agenda(id) on delete set null;
alter table public.personal_notes add column if not exists journal_id uuid references public.journals(id) on delete set null;
alter table public.personal_notes add column if not exists role_scope public.app_role;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='personal_notes_context_type_check') then
    alter table public.personal_notes add constraint personal_notes_context_type_check
      check(context_type in ('PERSONAL','MEMBER','MEETING','CLASS','PROGRAM','GENERAL'));
  end if;
  if not exists(select 1 from pg_constraint where conname='personal_notes_visibility_check') then
    alter table public.personal_notes add constraint personal_notes_visibility_check
      check(visibility in ('PRIVATE','ROLE','ACCESS'));
  end if;
end $$;

create index if not exists personal_notes_member_idx on public.personal_notes(member_id) where member_id is not null;
create index if not exists personal_notes_event_idx on public.personal_notes(attendance_event_id) where attendance_event_id is not null;
create index if not exists personal_notes_agenda_idx on public.personal_notes(agenda_id) where agenda_id is not null;
create index if not exists personal_notes_journal_idx on public.personal_notes(journal_id) where journal_id is not null;
create index if not exists personal_notes_class_idx on public.personal_notes(class_id) where class_id is not null;
create index if not exists personal_notes_audience_idx on public.personal_notes(audience) where audience is not null;

create or replace function public.can_access_context_note(p_note_id uuid,p_write boolean default false)
returns boolean
language plpgsql
stable security definer
set search_path=''
set row_security='off'
as $$
declare n public.personal_notes%rowtype; ok boolean:=false;
begin
  select * into n from public.personal_notes where id=p_note_id;
  if not found or public.current_app_user_id() is null then return false; end if;
  if n.owner_user_id=public.current_app_user_id() then return true; end if;
  if n.status='DELETED' or n.visibility='PRIVATE' then return false; end if;
  if p_write and not public.has_app_permission('note.write') then return false; end if;
  if not p_write and not public.has_app_permission('note.read') then return false; end if;
  if n.visibility='ROLE' then return n.role_scope is not null and n.role_scope=public.current_app_role(); end if;
  if n.member_id is not null then return case when p_write then public.can_write_member(n.member_id) else public.can_read_member(n.member_id) end; end if;
  if n.attendance_event_id is not null then return case when p_write then public.can_write_event(n.attendance_event_id) else public.can_read_event(n.attendance_event_id) end; end if;
  if n.journal_id is not null then return case when p_write then public.can_write_journal_id(n.journal_id) else public.can_read_journal_id(n.journal_id) end; end if;
  if n.agenda_id is not null then
    select case when p_write then public.can_write_scoped_audience(a.audience,a.class_id) else public.can_read_scoped_audience(a.audience,a.class_id) end
      into ok from public.agenda a where a.id=n.agenda_id;
    return coalesce(ok,false);
  end if;
  if n.class_id is not null then
    select case when p_write then public.can_write_scoped_audience(c.audience,c.id) else public.can_read_scoped_audience(c.audience,c.id) end
      into ok from public.classes c where c.id=n.class_id;
    return coalesce(ok,false);
  end if;
  if n.audience is not null then return case when p_write then public.can_write_audience(n.audience) else public.can_read_audience(n.audience) end; end if;
  return public.current_app_role()='ADMIN'::public.app_role;
end
$$;

drop policy if exists personal_notes_owner_read on public.personal_notes;
drop policy if exists personal_notes_access_read on public.personal_notes;
create policy personal_notes_access_read on public.personal_notes
for select using(public.can_access_context_note(id,false));

create or replace function public.list_context_notes(p_status text default 'ACTIVE')
returns setof public.personal_notes
language sql
stable security definer
set search_path=''
set row_security='off'
as $$
  select n.* from public.personal_notes n
  where n.status=p_status and public.can_access_context_note(n.id,false)
  order by n.is_pinned desc,n.updated_at desc
$$;

create or replace function public.save_context_note(p_id uuid,p_revision integer,p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  n public.personal_notes%rowtype;
  uid uuid:=public.current_app_user_id();
  s text; ct text; vis text;
  target_member uuid; target_class uuid; target_event uuid; target_agenda uuid; target_journal uuid;
  target_audience public.audience_type; scope_role public.app_role; allowed boolean:=false;
begin
  if uid is null then raise exception 'Login diperlukan'; end if;
  if p_revision is null or p_revision<0 then raise exception 'Revisi tidak valid'; end if;
  s:=coalesce(p_body->>'status','ACTIVE'); ct:=coalesce(p_body->>'context_type','PERSONAL'); vis:=coalesce(p_body->>'visibility','PRIVATE');
  if s not in ('ACTIVE','ARCHIVED','DELETED') then raise exception 'Status catatan tidak valid'; end if;
  if ct not in ('PERSONAL','MEMBER','MEETING','CLASS','PROGRAM','GENERAL') then raise exception 'Jenis catatan tidak valid'; end if;
  if vis not in ('PRIVATE','ROLE','ACCESS') then raise exception 'Visibilitas catatan tidak valid'; end if;
  if length(coalesce(p_body->>'title',''))>200 or length(coalesce(p_body->>'content',''))>100000 then raise exception 'Catatan terlalu panjang'; end if;

  target_member:=nullif(p_body->>'member_id','')::uuid;
  target_class:=nullif(p_body->>'class_id','')::uuid;
  target_event:=nullif(p_body->>'attendance_event_id','')::uuid;
  target_agenda:=nullif(p_body->>'agenda_id','')::uuid;
  target_journal:=nullif(p_body->>'journal_id','')::uuid;
  if nullif(p_body->>'audience','') is not null then target_audience:=(p_body->>'audience')::public.audience_type; end if;
  if vis='ROLE' then scope_role:=public.current_app_role(); end if;

  if ct='PERSONAL' then
    target_member:=null;target_class:=null;target_event:=null;target_agenda:=null;target_journal:=null;target_audience:=null;vis:='PRIVATE';scope_role:=null;
  elsif ct='MEMBER' and target_member is null then raise exception 'Pilih individu untuk catatan';
  elsif ct='CLASS' and target_class is null then raise exception 'Pilih kelas untuk catatan';
  elsif ct='PROGRAM' and target_audience is null then raise exception 'Pilih lingkup untuk catatan';
  elsif ct='MEETING' and target_event is null and target_agenda is null and target_journal is null then raise exception 'Pilih kegiatan atau pertemuan untuk catatan';
  end if;

  if ct='PERSONAL' then allowed:=true;
  elsif target_member is not null then allowed:=public.can_read_member(target_member);
  elsif target_event is not null then allowed:=public.can_read_event(target_event);
  elsif target_journal is not null then allowed:=public.can_read_journal_id(target_journal);
  elsif target_agenda is not null then select public.can_read_scoped_audience(a.audience,a.class_id) into allowed from public.agenda a where a.id=target_agenda;
  elsif target_class is not null then select public.can_read_scoped_audience(c.audience,c.id) into allowed from public.classes c where c.id=target_class;
  elsif target_audience is not null then allowed:=public.can_read_audience(target_audience);
  else allowed:=public.current_app_role()='ADMIN'::public.app_role;
  end if;
  if not coalesce(allowed,false) then raise exception 'Konteks catatan di luar akses'; end if;

  if p_id is null then
    insert into public.personal_notes(owner_user_id,title,content,is_pinned,status,archived_at,deleted_at,context_type,visibility,audience,class_id,member_id,attendance_event_id,agenda_id,journal_id,role_scope)
    values(uid,coalesce(nullif(trim(p_body->>'title'),''),'Tanpa judul'),coalesce(p_body->>'content',''),coalesce((p_body->>'is_pinned')::boolean,false),s,
      case when s='ARCHIVED' then now() end,case when s='DELETED' then now() end,ct,vis,target_audience,target_class,target_member,target_event,target_agenda,target_journal,scope_role)
    returning * into n;
  else
    select * into n from public.personal_notes where id=p_id for update;
    if not found or not public.can_access_context_note(p_id,true) then raise exception 'Catatan tidak ditemukan atau akses ditolak'; end if;
    if n.revision<>p_revision then raise exception 'CONFLICT: Catatan sudah diubah'; end if;
    update public.personal_notes set
      title=coalesce(nullif(trim(p_body->>'title'),''),'Tanpa judul'),content=coalesce(p_body->>'content',''),
      is_pinned=coalesce((p_body->>'is_pinned')::boolean,false),status=s,revision=revision+1,updated_at=now(),
      archived_at=case when s='ARCHIVED' then coalesce(archived_at,now()) else archived_at end,
      deleted_at=case when s='DELETED' then coalesce(deleted_at,now()) else deleted_at end,
      context_type=ct,visibility=vis,audience=target_audience,class_id=target_class,member_id=target_member,
      attendance_event_id=target_event,agenda_id=target_agenda,journal_id=target_journal,role_scope=scope_role
    where id=p_id returning * into n;
  end if;
  return to_jsonb(n);
end
$$;

create or replace function public.save_personal_note(p_id uuid,p_revision integer,p_body jsonb)
returns jsonb
language sql
security definer
set search_path=''
set row_security='off'
as $$ select public.save_context_note(p_id,p_revision,p_body) $$;

grant execute on function public.list_context_notes(text) to anon,authenticated;
grant execute on function public.save_context_note(uuid,integer,jsonb) to anon,authenticated;
