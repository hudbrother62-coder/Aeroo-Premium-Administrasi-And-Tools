-- Role-separated access, one-class Dewan Guru scope, and unified contextual notes.
-- Generated after QCL against the production schema.

create table if not exists public.user_class_scopes(
  user_id uuid primary key references public.app_users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  can_read boolean not null default true,
  can_write boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_class_scopes_class_id_idx on public.user_class_scopes(class_id);
alter table public.user_class_scopes enable row level security;
drop policy if exists user_class_scopes_read on public.user_class_scopes;
create policy user_class_scopes_read on public.user_class_scopes for select to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role or user_id=public.current_app_user_id());
drop policy if exists user_class_scopes_write on public.user_class_scopes;
create policy user_class_scopes_write on public.user_class_scopes for all to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role)
with check (public.current_app_role()='ADMIN'::public.app_role);
grant select,insert,update,delete on public.user_class_scopes to anon,authenticated;

-- Preserve the effective broad access of existing Dewan Guru accounts as explicit global scopes.
insert into public.user_audience_scopes(user_id,audience,can_read,can_write)
select u.id,'CABERAWIT'::public.audience_type,true,true from public.app_users u
where u.role='DEWAN_GURU'
  and not exists(select 1 from public.user_audience_scopes s where s.user_id=u.id and s.audience='CABERAWIT')
on conflict(user_id,audience) do nothing;
insert into public.user_audience_scopes(user_id,audience,can_read,can_write)
select u.id,'MUDA_MUDI'::public.audience_type,true,true from public.app_users u
where u.role='DEWAN_GURU'
  and not exists(select 1 from public.user_audience_scopes s where s.user_id=u.id and s.audience='MUDA_MUDI')
on conflict(user_id,audience) do nothing;

create table if not exists public.context_notes(
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null default 'Tanpa judul',
  content text not null default '',
  visibility text not null default 'PRIVATE' check(visibility in ('PRIVATE','ACCESS')),
  context_type text not null default 'PERSONAL' check(context_type in ('PERSONAL','MEMBER','EVENT','AGENDA','CLASS','AUDIENCE','JOURNAL','ENTITY')),
  audience public.audience_type,
  class_id uuid references public.classes(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  agenda_id uuid references public.agenda(id) on delete set null,
  event_id uuid references public.attendance_events(id) on delete set null,
  journal_id uuid references public.journals(id) on delete set null,
  entity_type text,
  entity_id uuid,
  context_label text,
  is_pinned boolean not null default false,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','ARCHIVED','DELETED')),
  revision integer not null default 0 check(revision>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);
create index if not exists context_notes_owner_idx on public.context_notes(owner_user_id,status,updated_at desc);
create index if not exists context_notes_member_idx on public.context_notes(member_id) where member_id is not null;
create index if not exists context_notes_event_idx on public.context_notes(event_id) where event_id is not null;
create index if not exists context_notes_agenda_idx on public.context_notes(agenda_id) where agenda_id is not null;
create index if not exists context_notes_class_idx on public.context_notes(class_id) where class_id is not null;
create index if not exists context_notes_journal_idx on public.context_notes(journal_id) where journal_id is not null;
alter table public.context_notes enable row level security;
grant select on public.context_notes to anon,authenticated;


CREATE OR REPLACE FUNCTION public.can_read_audience_global(p_audience audience_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when exists(
      select 1 from public.user_audience_scopes s
      where s.user_id=public.current_app_user_id()
        and s.audience=p_audience
    ) then coalesce((
      select s.can_read from public.user_audience_scopes s
      where s.user_id=public.current_app_user_id()
        and s.audience=p_audience
      limit 1
    ),false)
    when exists(
      select 1 from public.user_audience_scopes s
      where s.user_id=public.current_app_user_id()
    ) then false
    else case public.current_app_role()
      when 'DEWAN_GURU'::public.app_role then p_audience='MUDA_MUDI'::public.audience_type
      when 'KELOMPOK'::public.app_role then p_audience in ('KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS')
      when 'VIEWER'::public.app_role then p_audience in ('KELOMPOK','MUDA_MUDI','CABERAWIT','IBU_IBU')
      else false
    end
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_write_audience_global(p_audience audience_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when exists(
      select 1 from public.user_audience_scopes s
      where s.user_id=public.current_app_user_id()
        and s.audience=p_audience
    ) then coalesce((
      select s.can_write from public.user_audience_scopes s
      where s.user_id=public.current_app_user_id()
        and s.audience=p_audience
      limit 1
    ),false)
    when exists(
      select 1 from public.user_audience_scopes s
      where s.user_id=public.current_app_user_id()
    ) then false
    else case public.current_app_role()
      when 'DEWAN_GURU'::public.app_role then p_audience='MUDA_MUDI'::public.audience_type
      when 'KELOMPOK'::public.app_role then p_audience in ('KELOMPOK','IBU_IBU','PENGURUS')
      else false
    end
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_read_caberawit_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when public.can_read_audience_global('CABERAWIT'::public.audience_type) then true
    when public.current_app_role()='DEWAN_GURU'::public.app_role
      and p_class_id is not null
      then exists(
        select 1
        from public.user_class_scopes s
        join public.classes c on c.id=s.class_id
        where s.user_id=public.current_app_user_id()
          and s.class_id=p_class_id
          and s.can_read
          and c.audience='CABERAWIT'::public.audience_type
          and c.active
      )
    else false
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_write_caberawit_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when public.can_write_audience_global('CABERAWIT'::public.audience_type) then true
    when public.current_app_role()='DEWAN_GURU'::public.app_role
      and p_class_id is not null
      then exists(
        select 1
        from public.user_class_scopes s
        join public.classes c on c.id=s.class_id
        where s.user_id=public.current_app_user_id()
          and s.class_id=p_class_id
          and s.can_write
          and c.audience='CABERAWIT'::public.audience_type
          and c.active
      )
    else false
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_read_audience(p_audience audience_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when p_audience='CABERAWIT'::public.audience_type then
      public.can_read_audience_global(p_audience)
      or (
        public.current_app_role()='DEWAN_GURU'::public.app_role
        and exists(
          select 1 from public.user_class_scopes s
          where s.user_id=public.current_app_user_id() and s.can_read
        )
      )
    else public.can_read_audience_global(p_audience)
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_write_audience(p_audience audience_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when p_audience='CABERAWIT'::public.audience_type then
      public.can_write_audience_global(p_audience)
      or (
        public.current_app_role()='DEWAN_GURU'::public.app_role
        and exists(
          select 1 from public.user_class_scopes s
          where s.user_id=public.current_app_user_id() and s.can_write
        )
      )
    else public.can_write_audience_global(p_audience)
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_read_scoped_audience(p_audience audience_type, p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when p_audience='CABERAWIT'::public.audience_type
      then case when p_class_id is null
        then public.can_read_audience_global(p_audience)
        else public.can_read_caberawit_class(p_class_id)
      end
    else public.can_read_audience(p_audience)
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_write_scoped_audience(p_audience audience_type, p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when p_audience='CABERAWIT'::public.audience_type
      then case when p_class_id is null
        then public.can_write_audience_global(p_audience)
        else public.can_write_caberawit_class(p_class_id)
      end
    else public.can_write_audience(p_audience)
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_read_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select case
      when c.audience='CABERAWIT'::public.audience_type then public.can_read_caberawit_class(c.id)
      else public.can_read_audience(c.audience)
    end
    from public.classes c where c.id=p_class_id and c.active
  ),false)
$function$;

CREATE OR REPLACE FUNCTION public.can_write_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select case
      when c.audience='CABERAWIT'::public.audience_type then public.can_write_caberawit_class(c.id)
      else public.can_write_audience(c.audience)
    end
    from public.classes c where c.id=p_class_id and c.active
  ),false)
$function$;

CREATE OR REPLACE FUNCTION public.has_app_permission(p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when exists (
      select 1 from public.user_permissions up
      where up.user_id=public.current_app_user_id() and up.permission=p_permission
    ) then coalesce((
      select up.allowed from public.user_permissions up
      where up.user_id=public.current_app_user_id() and up.permission=p_permission
      limit 1
    ),false)
    else case p_permission
      when 'person.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'person.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'agenda.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'agenda.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'attendance.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'attendance.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'journal.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'journal.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'target.read' then public.current_app_role() in ('DEWAN_GURU','VIEWER')
      when 'target.write' then public.current_app_role()='DEWAN_GURU'
      when 'position.read' then public.current_app_role()='KELOMPOK'
      when 'position.write' then public.current_app_role()='KELOMPOK'
      when 'decision.write' then public.current_app_role()='KELOMPOK'
      when 'report.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'report.publish' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'import.manage' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'archive.manage' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'note.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'note.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      else false
    end
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_read_member(p_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select
    public.has_app_permission('person.read')
    and (
      public.current_app_role()='ADMIN'::public.app_role
      or public.can_read_audience_global('KELOMPOK'::public.audience_type)
      or exists (
        select 1
        from public.member_memberships mm
        join public.categories c on c.id=mm.category_id
        where mm.member_id=p_member_id
          and mm.valid_from <= (now() at time zone 'Asia/Jakarta')::date
          and (mm.valid_to is null or mm.valid_to >= (now() at time zone 'Asia/Jakarta')::date)
          and (mm.ended_on is null or mm.ended_on > (now() at time zone 'Asia/Jakarta')::date)
          and case c.slug
            when 'caberawit' then public.can_read_caberawit_class(mm.class_id)
            when 'muda-mudi' then public.can_read_audience('MUDA_MUDI'::public.audience_type)
            when 'ibu-ibu' then public.can_read_audience('IBU_IBU'::public.audience_type)
            else false
          end
      )
      or (
        public.can_read_audience('PENGURUS'::public.audience_type)
        and exists (
          select 1
          from public.organizational_positions op
          where op.member_id=p_member_id
            and op.active
            and op.valid_from <= (now() at time zone 'Asia/Jakarta')::date
            and (op.valid_to is null or op.valid_to >= (now() at time zone 'Asia/Jakarta')::date)
        )
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.can_write_member(p_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select
    public.has_app_permission('person.write')
    and (
      public.current_app_role()='ADMIN'::public.app_role
      or public.can_write_audience_global('KELOMPOK'::public.audience_type)
      or exists (
        select 1
        from public.member_memberships mm
        join public.categories c on c.id=mm.category_id
        where mm.member_id=p_member_id
          and mm.valid_from <= (now() at time zone 'Asia/Jakarta')::date
          and (mm.valid_to is null or mm.valid_to >= (now() at time zone 'Asia/Jakarta')::date)
          and (mm.ended_on is null or mm.ended_on > (now() at time zone 'Asia/Jakarta')::date)
          and case c.slug
            when 'caberawit' then public.can_write_caberawit_class(mm.class_id)
            when 'muda-mudi' then public.can_write_audience('MUDA_MUDI'::public.audience_type)
            when 'ibu-ibu' then public.can_write_audience('IBU_IBU'::public.audience_type)
            else false
          end
      )
      or (
        public.can_write_audience('PENGURUS'::public.audience_type)
        and exists (
          select 1
          from public.organizational_positions op
          where op.member_id=p_member_id
            and op.active
            and op.valid_from <= (now() at time zone 'Asia/Jakarta')::date
            and (op.valid_to is null or op.valid_to >= (now() at time zone 'Asia/Jakarta')::date)
        )
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.can_read_event(p_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select public.can_read_scoped_audience(e.audience,e.class_id)
    from public.attendance_events e
    where e.id=p_event_id
  ),false)
$function$;

CREATE OR REPLACE FUNCTION public.can_write_event(p_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select public.can_write_scoped_audience(e.audience,e.class_id)
    from public.attendance_events e
    where e.id=p_event_id
  ),false)
$function$;

CREATE OR REPLACE FUNCTION public.can_read_agenda(p_agenda_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select public.can_read_scoped_audience(a.audience,a.class_id)
    from public.agenda a
    where a.id=p_agenda_id
  ),false)
$function$;

CREATE OR REPLACE FUNCTION public.can_write_agenda(p_agenda_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select public.can_write_scoped_audience(a.audience,a.class_id)
    from public.agenda a
    where a.id=p_agenda_id
  ),false)
$function$;

CREATE OR REPLACE FUNCTION public.can_read_journal(p_event_id uuid, p_activity_type_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when p_event_id is not null then public.can_read_event(p_event_id)
    when p_activity_type_id is not null then coalesce((
      select case
        when a.audience='CABERAWIT'::public.audience_type
          then public.can_read_audience_global(a.audience)
        else public.can_read_audience(a.audience)
      end
      from public.activity_types a where a.id=p_activity_type_id
    ),false)
    else public.can_read_audience('CUSTOM'::public.audience_type)
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_write_journal(p_event_id uuid, p_activity_type_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select case
    when p_event_id is not null then public.can_write_event(p_event_id)
    when p_activity_type_id is not null then coalesce((
      select case
        when a.audience='CABERAWIT'::public.audience_type
          then public.can_write_audience_global(a.audience)
        else public.can_write_audience(a.audience)
      end
      from public.activity_types a where a.id=p_activity_type_id
    ),false)
    else public.can_write_audience('CUSTOM'::public.audience_type)
  end
$function$;

CREATE OR REPLACE FUNCTION public.can_read_journal_id(p_journal_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select case
      when public.journal_audience(j.journal_kind)='CABERAWIT'::public.audience_type
        then case
          when j.class_id is not null then public.can_read_caberawit_class(j.class_id)
          when j.event_id is not null then public.can_read_event(j.event_id)
          else public.can_read_audience_global('CABERAWIT'::public.audience_type)
        end
      else public.can_read_audience(public.journal_audience(j.journal_kind))
    end
    from public.journals j
    where j.id=p_journal_id
  ),false)
$function$;

CREATE OR REPLACE FUNCTION public.can_write_journal_id(p_journal_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select case
      when public.journal_audience(j.journal_kind)='CABERAWIT'::public.audience_type
        then case
          when j.class_id is not null then public.can_write_caberawit_class(j.class_id)
          when j.event_id is not null then public.can_write_event(j.event_id)
          else public.can_write_audience_global('CABERAWIT'::public.audience_type)
        end
      else public.can_write_audience(public.journal_audience(j.journal_kind))
    end
    from public.journals j
    where j.id=p_journal_id
  ),false)
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_user_access_v2(p_user_id uuid, p_scopes jsonb, p_permissions jsonb, p_class_scope jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  scope_row jsonb;
  permission_row jsonb;
  v_audience public.audience_type;
  v_permission text;
  v_role public.app_role;
  v_class_id uuid;
  v_class_read boolean:=true;
  v_class_write boolean:=true;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'Akses ditolak';
  end if;

  select role into v_role from public.app_users where id=p_user_id;
  if v_role is null then raise exception 'Akun tidak ditemukan'; end if;

  if p_scopes is null or jsonb_typeof(p_scopes)<>'array' then
    raise exception 'Daftar scope tidak valid';
  end if;
  if p_permissions is null or jsonb_typeof(p_permissions)<>'array' then
    raise exception 'Daftar permission tidak valid';
  end if;

  if p_class_scope is not null and jsonb_typeof(p_class_scope)<>'object' then
    raise exception 'Scope kelas tidak valid';
  end if;

  if nullif(p_class_scope->>'class_id','') is not null then
    if v_role<>'DEWAN_GURU'::public.app_role then
      raise exception 'Scope kelas Caberawit hanya untuk Dewan Guru';
    end if;
    begin
      v_class_id:=(p_class_scope->>'class_id')::uuid;
    exception when others then
      raise exception 'Kelas Caberawit tidak valid';
    end;
    if not exists(
      select 1 from public.classes c
      where c.id=v_class_id and c.audience='CABERAWIT'::public.audience_type and c.active
    ) then raise exception 'Kelas Caberawit tidak aktif atau tidak ditemukan'; end if;
    v_class_read:=coalesce((p_class_scope->>'can_read')::boolean,true);
    v_class_write:=coalesce((p_class_scope->>'can_write')::boolean,true);
    if v_class_write then v_class_read:=true; end if;
  end if;

  delete from public.user_audience_scopes where user_id=p_user_id;
  for scope_row in select value from jsonb_array_elements(p_scopes) loop
    begin
      v_audience:=(scope_row->>'audience')::public.audience_type;
    exception when others then
      raise exception 'Audience tidak valid';
    end;

    if v_audience not in ('KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','PENGURUS') then
      raise exception 'Audience tidak diizinkan';
    end if;

    insert into public.user_audience_scopes(user_id,audience,can_read,can_write)
    values(
      p_user_id,
      v_audience,
      case
        when v_audience='CABERAWIT'::public.audience_type and v_class_id is not null then false
        else coalesce((scope_row->>'can_read')::boolean,false) or coalesce((scope_row->>'can_write')::boolean,false)
      end,
      case
        when v_audience='CABERAWIT'::public.audience_type and v_class_id is not null then false
        else coalesce((scope_row->>'can_write')::boolean,false)
      end
    );
  end loop;

  delete from public.user_permissions where user_id=p_user_id;
  for permission_row in select value from jsonb_array_elements(p_permissions) loop
    v_permission:=permission_row->>'permission';
    if v_permission not in (
      'person.read','person.write','agenda.read','agenda.write',
      'attendance.read','attendance.write','journal.read','journal.write',
      'target.read','target.write','position.read','position.write',
      'decision.write','report.read','report.publish','import.manage',
      'archive.manage','user.manage','settings.manage','note.read','note.write'
    ) then raise exception 'Permission tidak diizinkan'; end if;

    insert into public.user_permissions(user_id,permission,allowed)
    values(p_user_id,v_permission,coalesce((permission_row->>'allowed')::boolean,false));
  end loop;

  delete from public.user_class_scopes where user_id=p_user_id;
  if v_class_id is not null then
    insert into public.user_class_scopes(user_id,class_id,can_read,can_write)
    values(p_user_id,v_class_id,v_class_read,v_class_write);
  end if;

  return jsonb_build_object(
    'scopes',(select count(*) from public.user_audience_scopes where user_id=p_user_id),
    'permissions',(select count(*) from public.user_permissions where user_id=p_user_id),
    'class_scope',(
      select jsonb_build_object(
        'class_id',ucs.class_id,
        'can_read',ucs.can_read,
        'can_write',ucs.can_write,
        'class_name',c.name
      )
      from public.user_class_scopes ucs
      join public.classes c on c.id=ucs.class_id
      where ucs.user_id=p_user_id
    )
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.can_read_context_note(p_note_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  n public.context_notes%rowtype;
  v_class_audience public.audience_type;
  v_known_anchor boolean;
begin
  select * into n from public.context_notes where id=p_note_id;
  if not found or public.current_app_user_id() is null then return false; end if;
  if n.owner_user_id=public.current_app_user_id() then return true; end if;
  if n.visibility<>'ACCESS' then return false; end if;
  if not public.has_app_permission('note.read') then return false; end if;
  if public.current_app_role()='ADMIN'::public.app_role then return true; end if;

  v_known_anchor:=n.audience is not null or n.class_id is not null or n.member_id is not null
    or n.agenda_id is not null or n.event_id is not null or n.journal_id is not null;
  if not v_known_anchor then return false; end if;

  if n.audience is not null then
    if n.audience='CABERAWIT'::public.audience_type and n.class_id is null then
      if not public.can_read_audience_global(n.audience) then return false; end if;
    elsif not public.can_read_audience(n.audience) then return false; end if;
  end if;

  if n.class_id is not null then
    select audience into v_class_audience from public.classes where id=n.class_id;
    if v_class_audience is null then return false; end if;
    if v_class_audience='CABERAWIT'::public.audience_type then
      if not public.can_read_caberawit_class(n.class_id) then return false; end if;
    elsif not public.can_read_audience(v_class_audience) then return false; end if;
  end if;

  if n.member_id is not null and not public.can_read_member(n.member_id) then return false; end if;
  if n.agenda_id is not null and not public.can_read_agenda(n.agenda_id) then return false; end if;
  if n.event_id is not null and not public.can_read_event(n.event_id) then return false; end if;
  if n.journal_id is not null and not public.can_read_journal_id(n.journal_id) then return false; end if;

  return true;
end
$function$;

CREATE OR REPLACE FUNCTION public.save_context_note(p_id uuid, p_revision integer, p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  n public.context_notes%rowtype;
  uid uuid:=public.current_app_user_id();
  s text;
  vis text;
  ctype text;
  v_class_audience public.audience_type;
  v_known_anchor boolean;
begin
  if uid is null then raise exception 'Login diperlukan'; end if;
  if not public.has_app_permission('note.write') then raise exception 'Akses catatan ditolak'; end if;
  if p_revision is null or p_revision<0 then raise exception 'Revisi tidak valid'; end if;

  s:=coalesce(p_body->>'status','ACTIVE');
  vis:=coalesce(p_body->>'visibility','PRIVATE');
  ctype:=coalesce(p_body->>'context_type','PERSONAL');

  if s not in ('ACTIVE','ARCHIVED','DELETED')
    or vis not in ('PRIVATE','ACCESS')
    or ctype not in ('PERSONAL','MEMBER','EVENT','AGENDA','CLASS','AUDIENCE','JOURNAL','ENTITY')
    or length(coalesce(p_body->>'title',''))>200
    or length(coalesce(p_body->>'content',''))>100000
    or length(coalesce(p_body->>'context_label',''))>300
    or length(coalesce(p_body->>'entity_type',''))>100
  then raise exception 'Catatan tidak valid'; end if;

  if p_id is null then
    n.id:=gen_random_uuid();
    n.owner_user_id:=uid;
    n.revision:=0;
    n.created_at:=now();
  else
    select * into n from public.context_notes where id=p_id and owner_user_id=uid for update;
    if not found then raise exception 'Catatan tidak ditemukan'; end if;
    if n.revision<>p_revision then raise exception 'CONFLICT: Catatan sudah diubah'; end if;
    n.revision:=n.revision+1;
  end if;

  n.title:=coalesce(nullif(trim(p_body->>'title'),''),'Tanpa judul');
  n.content:=coalesce(p_body->>'content','');
  n.visibility:=vis;
  n.context_type:=ctype;
  n.audience:=nullif(p_body->>'audience','')::public.audience_type;
  n.class_id:=nullif(p_body->>'class_id','')::uuid;
  n.member_id:=nullif(p_body->>'member_id','')::uuid;
  n.agenda_id:=nullif(p_body->>'agenda_id','')::uuid;
  n.event_id:=nullif(p_body->>'event_id','')::uuid;
  n.journal_id:=nullif(p_body->>'journal_id','')::uuid;
  n.entity_type:=nullif(trim(p_body->>'entity_type'),'');
  n.entity_id:=nullif(p_body->>'entity_id','')::uuid;
  n.context_label:=nullif(trim(p_body->>'context_label'),'');
  n.is_pinned:=coalesce((p_body->>'is_pinned')::boolean,false);
  n.status:=s;
  n.updated_at:=now();
  n.archived_at:=case when s='ARCHIVED' then coalesce(n.archived_at,now()) when s='ACTIVE' then null else n.archived_at end;
  n.deleted_at:=case when s='DELETED' then coalesce(n.deleted_at,now()) when s<>'DELETED' then null else n.deleted_at end;

  v_known_anchor:=n.audience is not null or n.class_id is not null or n.member_id is not null
    or n.agenda_id is not null or n.event_id is not null or n.journal_id is not null;

  -- Private notes may attach to a context, but cannot point into data the owner cannot read.
  if n.audience is not null then
    if n.audience='CABERAWIT'::public.audience_type and n.class_id is null then
      if not public.can_read_audience_global(n.audience) then raise exception 'Lingkup catatan di luar akses'; end if;
    elsif not public.can_read_audience(n.audience) then raise exception 'Lingkup catatan di luar akses'; end if;
  end if;

  if n.class_id is not null then
    select audience into v_class_audience from public.classes where id=n.class_id and active;
    if v_class_audience is null then raise exception 'Kelas catatan tidak valid'; end if;
    if v_class_audience='CABERAWIT'::public.audience_type then
      if not public.can_read_caberawit_class(n.class_id) then raise exception 'Kelas catatan di luar akses'; end if;
    elsif not public.can_read_audience(v_class_audience) then raise exception 'Kelas catatan di luar akses'; end if;
  end if;

  if n.member_id is not null and not public.can_read_member(n.member_id) then raise exception 'Anggota catatan di luar akses'; end if;
  if n.agenda_id is not null and not public.can_read_agenda(n.agenda_id) then raise exception 'Agenda catatan di luar akses'; end if;
  if n.event_id is not null and not public.can_read_event(n.event_id) then raise exception 'Pertemuan catatan di luar akses'; end if;
  if n.journal_id is not null and not public.can_read_journal_id(n.journal_id) then raise exception 'Jurnal catatan di luar akses'; end if;

  if vis='ACCESS' then
    if not v_known_anchor then raise exception 'Catatan akses harus terhubung data, kelas, kegiatan, pertemuan, atau lingkup'; end if;

    if n.audience is not null then
      if n.audience='CABERAWIT'::public.audience_type and n.class_id is null then
        if not public.can_write_audience_global(n.audience) then raise exception 'Tidak dapat membagikan catatan ke lingkup ini'; end if;
      elsif not public.can_write_audience(n.audience) then raise exception 'Tidak dapat membagikan catatan ke lingkup ini'; end if;
    end if;
    if n.class_id is not null then
      if v_class_audience='CABERAWIT'::public.audience_type then
        if not public.can_write_caberawit_class(n.class_id) then raise exception 'Tidak dapat membagikan catatan ke kelas ini'; end if;
      elsif not public.can_write_audience(v_class_audience) then raise exception 'Tidak dapat membagikan catatan ke kelas ini'; end if;
    end if;
    if n.member_id is not null and not public.can_write_member(n.member_id) then raise exception 'Tidak dapat membagikan catatan anggota ini'; end if;
    if n.agenda_id is not null and not public.can_write_agenda(n.agenda_id) then raise exception 'Tidak dapat membagikan catatan agenda ini'; end if;
    if n.event_id is not null and not public.can_write_event(n.event_id) then raise exception 'Tidak dapat membagikan catatan pertemuan ini'; end if;
    if n.journal_id is not null and not public.can_write_journal_id(n.journal_id) then raise exception 'Tidak dapat membagikan catatan jurnal ini'; end if;
  end if;

  if p_id is null then
    insert into public.context_notes(
      id,owner_user_id,title,content,visibility,context_type,audience,class_id,member_id,agenda_id,event_id,journal_id,
      entity_type,entity_id,context_label,is_pinned,status,revision,created_at,updated_at,archived_at,deleted_at
    ) values(
      n.id,n.owner_user_id,n.title,n.content,n.visibility,n.context_type,n.audience,n.class_id,n.member_id,n.agenda_id,n.event_id,n.journal_id,
      n.entity_type,n.entity_id,n.context_label,n.is_pinned,n.status,n.revision,n.created_at,n.updated_at,n.archived_at,n.deleted_at
    );
  else
    update public.context_notes set
      title=n.title,content=n.content,visibility=n.visibility,context_type=n.context_type,
      audience=n.audience,class_id=n.class_id,member_id=n.member_id,agenda_id=n.agenda_id,event_id=n.event_id,journal_id=n.journal_id,
      entity_type=n.entity_type,entity_id=n.entity_id,context_label=n.context_label,
      is_pinned=n.is_pinned,status=n.status,revision=n.revision,updated_at=n.updated_at,archived_at=n.archived_at,deleted_at=n.deleted_at
    where id=n.id;
  end if;

  return to_jsonb(n);
end
$function$;

CREATE OR REPLACE FUNCTION public.save_agenda(p_id uuid, p_revision integer, p_items jsonb, p_scope text DEFAULT 'this'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  old_g public.agenda%rowtype;
  g public.agenda%rowtype;
  x jsonb;
  v_series uuid;
  v_result jsonb:='[]';
  v_ids uuid[];
  v_date date;
begin
  if not public.has_app_permission('agenda.write') then raise exception 'Akses agenda ditolak'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>366 then raise exception 'Daftar agenda tidak valid';end if;
  if p_revision is null or p_revision<0 then raise exception 'Versi agenda wajib valid';end if;
  if p_id is not null and jsonb_array_length(p_items)<>1 then raise exception 'Perubahan satu agenda wajib satu objek';end if;
  if p_scope not in ('this','future','all') then raise exception 'Lingkup perubahan tidak valid';end if;

  if p_id is not null then
    select * into old_g from public.agenda where id=p_id for update;
    if not found or not coalesce(public.can_write_scoped_audience(old_g.audience,old_g.class_id),false) then raise exception 'Agenda di luar akses';end if;
    if old_g.revision is distinct from p_revision then raise exception 'CONFLICT: Agenda sudah diubah petugas lain';end if;
  end if;

  v_series:=coalesce(old_g.series_id,gen_random_uuid());

  for x in select value from jsonb_array_elements(p_items) loop
    g:=jsonb_populate_record(null::public.agenda,case when p_id is null then x else to_jsonb(old_g)||x end);
    if not coalesce(public.can_write_scoped_audience(g.audience,g.class_id),false) then raise exception 'Agenda di luar akses';end if;
    if length(trim(coalesce(g.title,'')))=0 or g.starts_at is null or (g.ends_at is not null and g.ends_at<=g.starts_at) then raise exception 'Judul atau waktu agenda tidak valid';end if;

    g.status:=coalesce(g.status,'SCHEDULED');
    g.attendance_enabled:=coalesce(g.attendance_enabled,true); g.journal_required:=coalesce(g.journal_required,false); g.documentation_required:=coalesce(g.documentation_required,false); g.target_tracking_enabled:=coalesce(g.target_tracking_enabled,false);
    g.participant_ids:=coalesce(g.participant_ids,'{}');
    g.recurrence:=coalesce(g.recurrence,'once');
    g.created_at:=coalesce(old_g.created_at,now());
    g.series_id:=v_series;
    v_date:=(g.starts_at at time zone 'Asia/Jakarta')::date;

    if g.level_id is not null and (g.audience not in ('CABERAWIT','MUDA_MUDI') or not exists(select 1 from public.levels where id=g.level_id and active)) then raise exception 'Jenjang tidak sesuai program';end if;
    if g.activity_type_id is not null and not exists(select 1 from public.activity_types where id=g.activity_type_id and audience=g.audience and active) then raise exception 'Jenis kegiatan tidak sesuai lingkup';end if;
    if g.class_id is not null and not exists(select 1 from public.classes where id=g.class_id and audience=g.audience and (g.level_id is null or level_id=g.level_id)) then raise exception 'Kelas tidak sesuai program atau jenjang';end if;

    if cardinality(g.participant_ids)>0
      and not (p_id is not null and g.starts_at is not distinct from old_g.starts_at and g.audience=old_g.audience and g.class_id is not distinct from old_g.class_id and g.level_id is not distinct from old_g.level_id and g.participant_ids is not distinct from old_g.participant_ids)
      and exists(
      select 1 from unnest(g.participant_ids) person
      where not exists(
        select 1
        from public.members m
        where m.id=person and m.status='ACTIVE'
          and (
            g.audience='KELOMPOK'
            or (
              g.audience='PENGURUS'
              and exists(
                select 1 from public.organizational_positions op
                where op.member_id=m.id and op.active
                  and op.valid_from<=v_date
                  and (op.valid_to is null or op.valid_to>=v_date)
              )
            )
            or (
              g.audience in ('CABERAWIT','MUDA_MUDI','IBU_IBU')
              and exists(
                select 1 from public.member_memberships mm
                join public.categories c on c.id=mm.category_id
                where mm.member_id=m.id
                  and c.slug=case g.audience when 'CABERAWIT' then 'caberawit' when 'MUDA_MUDI' then 'muda-mudi' when 'IBU_IBU' then 'ibu-ibu' end
                  and mm.valid_from<=v_date
                  and (mm.valid_to is null or mm.valid_to>=v_date)
                  and (mm.ended_on is null or mm.ended_on>v_date)
                  and (g.class_id is null or mm.class_id=g.class_id)
                  and (g.level_id is null or mm.level_id=g.level_id)
              )
            )
          )
      )
    ) then raise exception 'Sebagian peserta tidak sesuai lingkup, penempatan, jabatan, atau tanggal';end if;

    if p_id is null then
      g.id:=gen_random_uuid();g.revision:=0;
      insert into public.agenda select g.*;
      v_result:=v_result||jsonb_build_array(to_jsonb(g));
    else
      if exists(select 1 from public.attendance_events where agenda_id=old_g.id)
        and (g.starts_at is distinct from old_g.starts_at or g.ends_at is distinct from old_g.ends_at or g.audience<>old_g.audience or g.class_id is distinct from old_g.class_id or g.level_id is distinct from old_g.level_id or g.participant_ids is distinct from old_g.participant_ids)
      then raise exception 'Pertemuan sudah memiliki presensi; buat pertemuan baru untuk mengubah waktu atau daftar peserta';end if;

      select array_agg(id) into v_ids
      from public.agenda
      where id=p_id
         or (
           old_g.series_id is not null and series_id=old_g.series_id and (
             (p_scope='future' and starts_at>=old_g.starts_at)
             or p_scope='all'
           )
         );

      if exists(select 1 from public.agenda where id=any(v_ids) and not coalesce(public.can_write_scoped_audience(audience,class_id),false)) then raise exception 'Sebagian rangkaian di luar akses';end if;

      if p_scope in ('future','all') and exists(
        select 1
        from public.agenda a
        join public.attendance_events e on e.agenda_id=a.id
        where a.id=any(v_ids) and a.id<>p_id
          and (
            g.audience<>a.audience
            or g.class_id is distinct from a.class_id
            or g.level_id is distinct from a.level_id
            or g.participant_ids is distinct from a.participant_ids
            or g.starts_at is distinct from old_g.starts_at
            or g.ends_at is distinct from old_g.ends_at
          )
      ) then raise exception 'Rangkaian memiliki presensi; waktu atau daftar peserta tidak dapat diubah massal';end if;

      update public.agenda a set
        title=g.title,location=g.location,presenter=g.presenter,notes=g.notes,
        person_in_charge=g.person_in_charge,status=g.status,attendance_enabled=g.attendance_enabled,journal_required=g.journal_required,documentation_required=g.documentation_required,target_tracking_enabled=g.target_tracking_enabled,
        activity_type_id=g.activity_type_id,audience=g.audience,class_id=g.class_id,level_id=g.level_id,
        participant_ids=g.participant_ids,
        starts_at=case when a.id=p_id then g.starts_at else a.starts_at+(g.starts_at-old_g.starts_at) end,
        ends_at=case when a.id=p_id then g.ends_at else case when g.ends_at is null then null else a.starts_at+(g.starts_at-old_g.starts_at)+(g.ends_at-g.starts_at) end end,
        revision=a.revision+1
      where a.id=any(v_ids);

      update public.attendance_events set state=g.status,title=g.title where agenda_id=any(v_ids);
      v_result:=v_result||(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.agenda a where id=any(v_ids));
    end if;
  end loop;
  return v_result;
end
$function$;

CREATE OR REPLACE FUNCTION public.ensure_attendance(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  e public.attendance_events%rowtype;
  g public.agenda%rowtype;
  a public.audience_type;
  v_key text;
  v_slug text;
  v_date date;
  v_class uuid;
  v_level uuid;
  v_activity uuid;
  v_teacher text;
  v_people uuid[] := '{}';
begin
  if nullif(p_event->>'agenda_id','') is not null then
    select * into g from public.agenda where id=(p_event->>'agenda_id')::uuid;
    if not found or g.status='CANCELLED' or not g.attendance_enabled then raise exception 'Agenda tidak dapat diabsen'; end if;
    v_class:=g.class_id; v_level:=g.level_id; v_activity:=g.activity_type_id; v_people:=g.participant_ids;
    v_teacher:=coalesce(nullif(trim(g.presenter),''),nullif(trim(g.person_in_charge),''));
    a:=g.audience; v_date:=(g.starts_at at time zone 'Asia/Jakarta')::date; v_key:='agenda:'||g.id;
  else
    v_class:=nullif(p_event->>'class_id','')::uuid;
    v_level:=nullif(p_event->>'level_id','')::uuid;
    v_activity:=nullif(p_event->>'activity_type_id','')::uuid;
    v_teacher:=nullif(trim(coalesce(p_event->>'teacher_name','')),'');
    if p_event->'member_ids' is not null and jsonb_typeof(p_event->'member_ids')<>'array' then raise exception 'Daftar peserta tidak valid'; end if;
    select coalesce(array_agg(distinct value::uuid order by value::uuid),'{}') into v_people
    from jsonb_array_elements_text(coalesce(p_event->'member_ids','[]'));
    a:=(p_event->>'audience')::public.audience_type;
    v_date:=(p_event->>'event_date')::date;
    v_key:=a||':'||v_date||':'||coalesce(p_event->>'class_id','')||':'||coalesce(p_event->>'level_id','')||':'||coalesce(p_event->>'event_time','')||':'||lower(trim(p_event->>'title'))||':'||coalesce(lower(v_teacher),'')||':'||array_to_string(v_people,',');
  end if;

  if not coalesce(public.can_write_scoped_audience(a,v_class),false) then raise exception 'Kegiatan di luar akses'; end if;
  if a is null or v_date is null then raise exception 'Lingkup dan tanggal wajib diisi'; end if;
  if g.id is null and a='CABERAWIT' and v_class is null then raise exception 'Kelas Caberawit wajib dipilih'; end if;
  if g.id is null and a='CABERAWIT' and v_teacher is null then raise exception 'Dewan Guru yang mengajar wajib diisi'; end if;
  if v_class is not null and not exists(select 1 from public.classes where id=v_class and audience=a and active and (v_level is null or level_id=v_level)) then raise exception 'Kelas tidak sesuai program atau jenjang'; end if;
  if v_level is not null and (a not in ('CABERAWIT','MUDA_MUDI') or not exists(select 1 from public.levels where id=v_level and active)) then raise exception 'Jenjang tidak sesuai program'; end if;
  if v_activity is not null and not exists(select 1 from public.activity_types where id=v_activity and audience=a and active) then raise exception 'Jenis kegiatan tidak sesuai lingkup'; end if;
  if v_class is not null and v_level is null then select level_id into v_level from public.classes where id=v_class; end if;
  if g.id is null and length(trim(coalesce(p_event->>'title','')))=0 then raise exception 'Judul kegiatan wajib diisi'; end if;
  if g.id is null then v_key:=a||':'||v_date||':'||coalesce(v_class::text,'')||':'||coalesce(v_level::text,'')||':'||coalesce(v_activity::text,'')||':'||coalesce(p_event->>'event_time','')||':'||lower(trim(p_event->>'title'))||':'||coalesce(lower(v_teacher),'')||':'||array_to_string(v_people,','); end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select * into e from public.attendance_events where session_key=v_key;

  if not found then
    insert into public.attendance_events(title,event_date,event_time,audience,activity_type_id,class_id,level_id,agenda_id,session_key,notes,teacher_name)
    values(coalesce(g.title,p_event->>'title'),v_date,coalesce((g.starts_at at time zone 'Asia/Jakarta')::time,nullif(p_event->>'event_time','')::time),a,v_activity,v_class,v_level,g.id,v_key,p_event->>'notes',v_teacher)
    returning * into e;

    if a='KELOMPOK' then
      insert into public.attendance_records(event_id,member_id,participant_key,status,member_name_snapshot,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot)
      select e.id,m.id,m.id,null,m.name,null,null,null,null
      from public.members m
      where m.status='ACTIVE'
        and (cardinality(v_people)=0 or m.id=any(v_people))
      order by m.name;

    elsif a='PENGURUS' then
      insert into public.attendance_records(event_id,member_id,participant_key,status,member_name_snapshot,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot)
      select distinct on(m.id) e.id,m.id,m.id,null,m.name,null,null,null,null
      from public.members m
      join public.organizational_positions op on op.member_id=m.id
      where m.status='ACTIVE'
        and op.active
        and op.valid_from<=v_date
        and (op.valid_to is null or op.valid_to>=v_date)
        and (cardinality(v_people)=0 or m.id=any(v_people))
      order by m.id,op.valid_from desc;

    else
      v_slug:=case a when 'CABERAWIT' then 'caberawit' when 'MUDA_MUDI' then 'muda-mudi' when 'IBU_IBU' then 'ibu-ibu' else null end;
      insert into public.attendance_records(event_id,member_id,participant_key,status,member_name_snapshot,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot)
      select distinct on(m.id) e.id,m.id,m.id,null,m.name,mm.class_id,mm.level_id,c.name,l.name
      from public.members m
      join public.member_memberships mm on mm.member_id=m.id
      join public.categories cat on cat.id=mm.category_id
      left join public.classes c on c.id=mm.class_id
      left join public.levels l on l.id=mm.level_id
      where (m.status='ACTIVE' or v_date<(m.updated_at at time zone 'Asia/Jakarta')::date)
        and (mm.active or mm.ended_on is not null or mm.valid_to is not null)
        and (mm.ended_on is null or v_date<mm.ended_on)
        and cat.slug=v_slug
        and mm.valid_from<=v_date
        and (mm.valid_to is null or mm.valid_to>=v_date)
        and (e.class_id is null or mm.class_id=e.class_id)
        and (e.level_id is null or mm.level_id=e.level_id)
        and (cardinality(v_people)=0 or m.id=any(v_people))
      order by m.id,mm.created_at desc;
    end if;

    if cardinality(v_people)>0 and (select count(*) from public.attendance_records where event_id=e.id)<>cardinality(v_people) then
      raise exception 'Sebagian peserta tidak sesuai lingkup, penempatan, jabatan, atau tanggal';
    end if;
  end if;

  return to_jsonb(e);
end
$function$;

CREATE OR REPLACE FUNCTION public.save_journal(p_id uuid, p_revision integer, p_body jsonb, p_progress jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare j public.journals%rowtype;old_j public.journals%rowtype;e public.attendance_events%rowtype;g public.agenda%rowtype;a public.audience_type;x jsonb;v_member uuid;v_target uuid;v_name text;begin
 if p_revision is null or p_revision<0 then raise exception 'Versi jurnal wajib valid';end if;
 a:=public.journal_audience(p_body->>'journal_kind');
 if a is null then raise exception 'Jenis jurnal di luar akses';end if;
 if a<>'CABERAWIT'::public.audience_type and not coalesce(public.can_write_audience(a),false) then raise exception 'Jenis jurnal di luar akses';end if;
 if p_body->>'journal_kind' not in ('KELOMPOK','PENGKAJIAN','IBU_IBU','PENGURUS','CABERAWIT_CLASS','CABERAWIT_INDIVIDUAL','MUDA_MUDI_CLASS','MUDA_MUDI_INDIVIDUAL') then raise exception 'Jenis jurnal tidak valid';end if;
 if p_id is not null then select * into old_j from public.journals where id=p_id for update;if not found or not public.can_write_journal_id(p_id) then raise exception 'Jurnal di luar akses';end if;if old_j.revision is distinct from p_revision then raise exception 'CONFLICT: Jurnal sudah diubah petugas lain';end if;end if;
 j:=jsonb_populate_record(null::public.journals,case when p_id is null then p_body else to_jsonb(old_j)||p_body end);
 j.id:=coalesce(p_id,gen_random_uuid());j.journal_kind:=p_body->>'journal_kind';j.state:=coalesce(j.state,'DRAFT');j.assessment:=coalesce(j.assessment,'{}');j.revision:=coalesce(old_j.revision,-1)+1;j.created_at:=coalesce(old_j.created_at,now());j.updated_at:=now();
 if a='CABERAWIT'::public.audience_type and not coalesce(public.can_write_scoped_audience(a,j.class_id),false) then raise exception 'Kelas Caberawit di luar akses';end if;
 if j.state not in ('DRAFT','COMPLETED','ARCHIVED') or j.journal_date is null or length(trim(coalesce(j.title,'')))=0 then raise exception 'Judul, tanggal, dan status jurnal wajib valid';end if;
 if j.ended_at is not null and j.started_at is not null and j.ended_at=j.started_at then raise exception 'Durasi tidak valid';end if; if j.ended_at is not null and j.started_at is not null and j.ended_at<j.started_at and j.journal_kind<>'PENGKAJIAN' then raise exception 'Jam selesai harus setelah mulai';end if;
 if j.journal_kind='PENGKAJIAN' then
 if j.started_at is null or j.ended_at is null then raise exception 'Waktu pengkajian wajib diisi';end if;
 if nullif(trim(j.assessment->>'presenter'),'') is null or nullif(trim(j.assessment->>'implementation'),'') is null then raise exception 'Pemateri dan pelaksanaan wajib diisi';end if;
 if jsonb_typeof(j.assessment->'materials') is distinct from 'array' or jsonb_array_length(j.assessment->'materials')=0 then raise exception 'Materi pengkajian wajib diisi';end if;
 for x in select value from jsonb_array_elements(j.assessment->'materials') loop
 if nullif(trim(x->>'topic'),'') is null or coalesce(x->>'status','') not in ('BELUM','SEBAGIAN','TUNTAS') then raise exception 'Materi pengkajian tidak valid';end if;
 end loop;
 end if;
 if j.agenda_id is not null then select * into g from public.agenda where id=j.agenda_id;if not found or g.audience<>a or not coalesce(public.can_write_agenda(g.id),false) or (g.status='CANCELLED' and j.state<>'ARCHIVED') or (g.starts_at at time zone 'Asia/Jakarta')::date<>j.journal_date then raise exception 'Agenda tidak sesuai jurnal';end if;end if;
 if j.event_id is not null then select * into e from public.attendance_events where id=j.event_id;if not found or e.audience<>a or not public.can_write_event(e.id) or (e.state='CANCELLED' and j.state<>'ARCHIVED') then raise exception 'Pertemuan tidak sesuai jurnal';end if;if j.agenda_id is not null and e.agenda_id is distinct from j.agenda_id then raise exception 'Pertemuan tidak sesuai agenda';end if;if e.event_date<>j.journal_date or (e.class_id is not null and e.class_id is distinct from j.class_id) then raise exception 'Tanggal atau kelas jurnal tidak sesuai pertemuan';end if;end if;
 if j.activity_type_id is not null and not exists(select 1 from public.activity_types where id=j.activity_type_id and audience=a and active) then raise exception 'Jenis kegiatan tidak sesuai jurnal';end if;
 if j.class_id is not null and not exists(select 1 from public.classes where id=j.class_id and audience=a) then raise exception 'Kelas tidak sesuai jurnal';end if;
 if j.journal_kind like '%_INDIVIDUAL' and j.event_id is null then raise exception 'Jurnal individu harus terhubung pertemuan';end if;
 if j.member_id is not null and not exists(select 1 from public.attendance_records where event_id=j.event_id and member_id=j.member_id) then raise exception 'Anggota bukan peserta pertemuan';end if;
 if jsonb_typeof(coalesce(p_progress,'[]'))<>'array' then raise exception 'Penilaian harus berupa daftar';end if;
 if j.journal_kind not like '%_INDIVIDUAL' and jsonb_array_length(coalesce(p_progress,'[]'))>0 then raise exception 'Penilaian individu harus memakai jurnal individu';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_progress,'[]')) el group by el->>'member_id',el->>'target_id' having count(*)>1) then raise exception 'Target peserta digandakan';end if;
 for x in select value from jsonb_array_elements(coalesce(p_progress,'[]')) loop
 v_member:=(x->>'member_id')::uuid;v_target:=nullif(x->>'target_id','')::uuid;
 if j.state<>'ARCHIVED' and not exists(select 1 from public.attendance_records where event_id=j.event_id and participant_key=v_member and status='H') then raise exception 'Hanya peserta hadir yang dapat dinilai';end if;
 if nullif(x->>'progress_value','') is not null and ((x->>'progress_value')::numeric<0 or (x->>'progress_value')::numeric>100) then raise exception 'Progres harus 0–100';end if; if coalesce(nullif(x->>'source',''),'JOURNAL')='ADJUSTMENT' and nullif(trim(x->>'correction_reason'),'') is null then raise exception 'Alasan koreksi wajib diisi untuk adjustment'; end if;
 if v_target is not null and not exists(select 1 from public.learning_targets t join public.attendance_records r on r.event_id=j.event_id and r.participant_key=v_member where t.id=v_target and (t.level_id is null or t.level_id=r.level_id_snapshot) and (t.class_id is null or t.class_id=r.class_id_snapshot) and (t.target_month is null or date_trunc('month',t.target_month)=date_trunc('month',j.journal_date))) then raise exception 'Target tidak sesuai jenjang, kelas, atau bulan';end if;
 end loop;
 if p_id is not null then insert into public.journal_revisions(journal_id,actor_id,actor_name,snapshot) values(p_id,public.current_app_user_id(),(select coalesce(display_name,username) from public.app_users where id=public.current_app_user_id()),to_jsonb(old_j)||jsonb_build_object('progress',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.journal_progress p where journal_id=p_id)));
 update public.journals set agenda_id=j.agenda_id,journal_date=j.journal_date,journal_kind=j.journal_kind,event_id=j.event_id,activity_type_id=j.activity_type_id,title=j.title,material=j.material,person_in_charge=j.person_in_charge,summary=j.summary,result=j.result,obstacles=j.obstacles,follow_up=j.follow_up,notes=j.notes,class_id=j.class_id,member_id=j.member_id,started_at=j.started_at,ended_at=j.ended_at,achievement=j.achievement,improvement_plan=j.improvement_plan,decisions=j.decisions,assessment=coalesce(j.assessment,'{}'),state=j.state,revision=j.revision,updated_at=now() where id=j.id;
 delete from public.journal_progress where journal_id=j.id;
 else insert into public.journals select j.*;end if;
 for x in select value from jsonb_array_elements(coalesce(p_progress,'[]')) loop
 select member_name_snapshot into v_name from public.attendance_records where event_id=j.event_id and participant_key=(x->>'member_id')::uuid;
 insert into public.journal_progress(journal_id,member_id,participant_key,member_name_snapshot,target_id,progress_value,progress_note,assessment,follow_up,source,evidence,correction_reason) values(j.id,(select id from public.members where id=(x->>'member_id')::uuid),(x->>'member_id')::uuid,v_name,nullif(x->>'target_id','')::uuid,nullif(x->>'progress_value','')::numeric,coalesce(x->>'progress_note',''),coalesce(x->'assessment','{}'),nullif(x->>'follow_up',''),coalesce(nullif(x->>'source',''),'JOURNAL'),case when jsonb_typeof(x->'evidence')='array' and jsonb_array_length(x->'evidence')>0 then x->'evidence' else jsonb_build_array(jsonb_build_object('type','JOURNAL','journal_id',j.id,'event_id',j.event_id,'agenda_id',j.agenda_id,'journal_date',j.journal_date)) end,nullif(x->>'correction_reason',''));
 end loop;
 return to_jsonb(j);
end $function$;


drop policy if exists context_notes_read on public.context_notes;
create policy context_notes_read on public.context_notes for select to anon,authenticated
using (public.can_read_context_note(id));

drop policy if exists agenda_read on public.agenda;
create policy agenda_read on public.agenda for select to anon,authenticated
using (public.has_app_permission('agenda.read') and public.can_read_scoped_audience(audience,class_id));
drop policy if exists agenda_insert on public.agenda;
create policy agenda_insert on public.agenda for insert to anon,authenticated
with check (public.has_app_permission('agenda.write') and public.can_write_scoped_audience(audience,class_id));
drop policy if exists agenda_update on public.agenda;
create policy agenda_update on public.agenda for update to anon,authenticated
using (public.has_app_permission('agenda.write') and public.can_write_scoped_audience(audience,class_id))
with check (public.has_app_permission('agenda.write') and public.can_write_scoped_audience(audience,class_id));
drop policy if exists agenda_delete on public.agenda;
create policy agenda_delete on public.agenda for delete to anon,authenticated
using (public.has_app_permission('agenda.write') and public.can_write_scoped_audience(audience,class_id));

drop policy if exists attendance_events_read on public.attendance_events;
create policy attendance_events_read on public.attendance_events for select to anon,authenticated
using (public.has_app_permission('attendance.read') and public.can_read_scoped_audience(audience,class_id));
drop policy if exists attendance_events_insert on public.attendance_events;
create policy attendance_events_insert on public.attendance_events for insert to anon,authenticated
with check (public.has_app_permission('attendance.write') and public.can_write_scoped_audience(audience,class_id));
drop policy if exists attendance_events_update on public.attendance_events;
create policy attendance_events_update on public.attendance_events for update to anon,authenticated
using (public.has_app_permission('attendance.write') and public.can_write_scoped_audience(audience,class_id))
with check (public.has_app_permission('attendance.write') and public.can_write_scoped_audience(audience,class_id));
drop policy if exists attendance_events_delete on public.attendance_events;
create policy attendance_events_delete on public.attendance_events for delete to anon,authenticated
using (public.has_app_permission('attendance.write') and public.can_write_scoped_audience(audience,class_id));

drop policy if exists journals_read on public.journals;
create policy journals_read on public.journals for select to anon,authenticated
using (
  public.has_app_permission('journal.read') and
  case when public.journal_audience(journal_kind)='CABERAWIT'::public.audience_type then
    case when class_id is not null then public.can_read_caberawit_class(class_id)
         when event_id is not null then public.can_read_event(event_id)
         else public.can_read_audience_global('CABERAWIT'::public.audience_type) end
  else public.can_read_audience(public.journal_audience(journal_kind)) end
);
drop policy if exists journals_insert on public.journals;
create policy journals_insert on public.journals for insert to anon,authenticated
with check (
  public.has_app_permission('journal.write') and
  case when public.journal_audience(journal_kind)='CABERAWIT'::public.audience_type then
    case when class_id is not null then public.can_write_caberawit_class(class_id)
         when event_id is not null then public.can_write_event(event_id)
         else public.can_write_audience_global('CABERAWIT'::public.audience_type) end
  else public.can_write_audience(public.journal_audience(journal_kind)) end
);
drop policy if exists journals_update on public.journals;
create policy journals_update on public.journals for update to anon,authenticated
using (public.has_app_permission('journal.write') and public.can_write_journal_id(id))
with check (public.has_app_permission('journal.write') and public.can_write_journal_id(id));
drop policy if exists journals_delete on public.journals;
create policy journals_delete on public.journals for delete to anon,authenticated
using (public.has_app_permission('journal.write') and public.can_write_journal_id(id));

drop policy if exists journal_progress_read on public.journal_progress;
create policy journal_progress_read on public.journal_progress for select to anon,authenticated
using (exists(select 1 from public.journals j where j.id=journal_progress.journal_id and public.can_read_journal_id(j.id)));
drop policy if exists journal_progress_write on public.journal_progress;
create policy journal_progress_write on public.journal_progress for all to anon,authenticated
using (exists(select 1 from public.journals j where j.id=journal_progress.journal_id and public.can_write_journal_id(j.id)))
with check (exists(select 1 from public.journals j where j.id=journal_progress.journal_id and public.can_write_journal_id(j.id)));

drop policy if exists caberawit_read on public.caberawit;
create policy caberawit_read on public.caberawit for select to anon,authenticated
using (public.can_read_audience_global('CABERAWIT'::public.audience_type));
drop policy if exists caberawit_write on public.caberawit;
create policy caberawit_write on public.caberawit for all to anon,authenticated
using (public.can_write_audience_global('CABERAWIT'::public.audience_type))
with check (public.can_write_audience_global('CABERAWIT'::public.audience_type));

drop policy if exists caberawit_progress_read on public.caberawit_progress;
create policy caberawit_progress_read on public.caberawit_progress for select to anon,authenticated
using (public.can_read_audience_global('CABERAWIT'::public.audience_type));
drop policy if exists caberawit_progress_write on public.caberawit_progress;
create policy caberawit_progress_write on public.caberawit_progress for all to anon,authenticated
using (public.can_write_audience_global('CABERAWIT'::public.audience_type))
with check (public.can_write_audience_global('CABERAWIT'::public.audience_type));

drop policy if exists class_teachers_read on public.class_teachers;
create policy class_teachers_read on public.class_teachers for select to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role or public.can_read_caberawit_class(class_id));
drop policy if exists class_teachers_write on public.class_teachers;
create policy class_teachers_write on public.class_teachers for all to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role)
with check (public.current_app_role()='ADMIN'::public.app_role);

drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes for all to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role)
with check (public.current_app_role()='ADMIN'::public.app_role);
drop policy if exists levels_write on public.levels;
create policy levels_write on public.levels for all to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role)
with check (public.current_app_role()='ADMIN'::public.app_role);

drop policy if exists learning_targets_read on public.learning_targets;
create policy learning_targets_read on public.learning_targets for select to anon,authenticated
using (public.has_app_permission('target.read') and (class_id is null or public.can_read_class(class_id)));
drop policy if exists learning_targets_insert on public.learning_targets;
create policy learning_targets_insert on public.learning_targets for insert to anon,authenticated
with check (
 public.has_app_permission('target.write') and (
  (class_id is not null and public.can_write_class(class_id)) or
  (class_id is null and (public.current_app_role()='ADMIN'::public.app_role
   or public.can_write_audience_global('CABERAWIT'::public.audience_type)
   or public.can_write_audience_global('MUDA_MUDI'::public.audience_type)))
 )
);
drop policy if exists learning_targets_update on public.learning_targets;
create policy learning_targets_update on public.learning_targets for update to anon,authenticated
using (
 public.has_app_permission('target.write') and (
  (class_id is not null and public.can_write_class(class_id)) or
  (class_id is null and (public.current_app_role()='ADMIN'::public.app_role
   or public.can_write_audience_global('CABERAWIT'::public.audience_type)
   or public.can_write_audience_global('MUDA_MUDI'::public.audience_type)))
 )
)
with check (
 public.has_app_permission('target.write') and (
  (class_id is not null and public.can_write_class(class_id)) or
  (class_id is null and (public.current_app_role()='ADMIN'::public.app_role
   or public.can_write_audience_global('CABERAWIT'::public.audience_type)
   or public.can_write_audience_global('MUDA_MUDI'::public.audience_type)))
 )
);
drop policy if exists learning_targets_delete on public.learning_targets;
create policy learning_targets_delete on public.learning_targets for delete to anon,authenticated
using (
 public.has_app_permission('target.write') and (
  (class_id is not null and public.can_write_class(class_id)) or
  (class_id is null and (public.current_app_role()='ADMIN'::public.app_role
   or public.can_write_audience_global('CABERAWIT'::public.audience_type)
   or public.can_write_audience_global('MUDA_MUDI'::public.audience_type)))
 )
);

drop policy if exists target_versions_write on public.target_versions;
create policy target_versions_write on public.target_versions for all to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role
  or public.can_write_audience_global('CABERAWIT'::public.audience_type)
  or public.can_write_audience_global('MUDA_MUDI'::public.audience_type))
with check (public.current_app_role()='ADMIN'::public.app_role
  or public.can_write_audience_global('CABERAWIT'::public.audience_type)
  or public.can_write_audience_global('MUDA_MUDI'::public.audience_type));

drop policy if exists report_templates_write on public.report_templates;
create policy report_templates_write on public.report_templates for all to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role)
with check (public.current_app_role()='ADMIN'::public.app_role);

insert into public.context_notes(
 id,owner_user_id,title,content,visibility,context_type,is_pinned,status,revision,created_at,updated_at,archived_at,deleted_at
)
select p.id,p.owner_user_id,p.title,p.content,'PRIVATE','PERSONAL',p.is_pinned,p.status,p.revision,p.created_at,p.updated_at,p.archived_at,p.deleted_at
from public.personal_notes p
where not exists(select 1 from public.context_notes n where n.id=p.id);
