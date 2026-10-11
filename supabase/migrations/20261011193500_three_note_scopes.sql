-- Split Simpul notes into personal (existing), role and main storage.
BEGIN;
CREATE TABLE IF NOT EXISTS public.role_notes (
id uuid primary key default gen_random_uuid(),
owner_user_id uuid not null references public.app_users(id),
role_scope public.app_role not null,
title text not null default 'Tanpa judul', content text not null default '',
is_pinned boolean not null default false,
status text not null default 'ACTIVE' check(status in('ACTIVE','ARCHIVED','DELETED')),
revision integer not null default 0 check(revision>=0),
created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
archived_at timestamptz,deleted_at timestamptz);
CREATE TABLE IF NOT EXISTS public.main_notes (
id uuid primary key default gen_random_uuid(),
owner_user_id uuid not null references public.app_users(id),
title text not null default 'Tanpa judul', content text not null default '',
is_pinned boolean not null default false,
status text not null default 'ACTIVE' check(status in('ACTIVE','ARCHIVED','DELETED')),
revision integer not null default 0 check(revision>=0),
created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
archived_at timestamptz,deleted_at timestamptz);
CREATE INDEX IF NOT EXISTS role_notes_feed_idx ON public.role_notes(role_scope,status,is_pinned DESC,updated_at DESC);
CREATE INDEX IF NOT EXISTS main_notes_feed_idx ON public.main_notes(status,is_pinned DESC,updated_at DESC);
ALTER TABLE public.role_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.main_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.role_notes,public.main_notes FROM public,anon,authenticated;
-- Only migrate notes with the same existing audience; preserve old records unchanged.
INSERT INTO public.role_notes(id,owner_user_id,role_scope,title,content,is_pinned,status,revision,created_at,updated_at,archived_at,deleted_at)
SELECT id,owner_user_id,role_scope,title,content,is_pinned,status,revision,created_at,updated_at,archived_at,deleted_at
FROM public.personal_notes WHERE visibility='ROLE' and role_scope IS NOT NULL ON CONFLICT(id) DO NOTHING;
INSERT INTO public.main_notes(id,owner_user_id,title,content,is_pinned,status,revision,created_at,updated_at,archived_at,deleted_at)
SELECT id,owner_user_id,title,content,is_pinned,status,revision,created_at,updated_at,archived_at,deleted_at
FROM public.personal_notes WHERE visibility='ACCESS' and context_type='GENERAL'
and audience is null and class_id is null and member_id is null and attendance_event_id is null
and agenda_id is null and journal_id is null ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_scope_notes(p_scope text, p_status text DEFAULT 'ACTIVE'::text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_user uuid:=public.current_app_user_id(); v_role public.app_role:=public.current_app_role();
begin
 if v_user is null then raise exception 'Login diperlukan'; end if;
 if p_scope not in ('PERSONAL','ROLE','MAIN') then raise exception 'Jenis catatan tidak valid'; end if;
 if p_status not in ('ACTIVE','ARCHIVED','DELETED') then raise exception 'Status catatan tidak valid'; end if;
 if p_scope='PERSONAL' then
  return query select to_jsonb(n)||jsonb_build_object('scope','PERSONAL') from public.personal_notes n
   where n.owner_user_id=v_user and n.visibility='PRIVATE' and n.status=p_status
   order by n.is_pinned desc,n.updated_at desc;
 elsif p_scope='ROLE' then
  return query select to_jsonb(n)||jsonb_build_object('scope','ROLE') from public.role_notes n
   where n.role_scope=v_role and n.status=p_status
   order by n.is_pinned desc,n.updated_at desc;
 else
  return query select to_jsonb(n)||jsonb_build_object('scope','MAIN') from public.main_notes n
   where n.status=p_status
   order by n.is_pinned desc,n.updated_at desc;
 end if;
end
$function$


CREATE OR REPLACE FUNCTION public.save_scope_note(p_scope text, p_id uuid, p_revision integer, p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
 v_user uuid:=public.current_app_user_id();
 v_role public.app_role:=public.current_app_role();
 v_status text:=coalesce(p_body->>'status','ACTIVE');
 v_title text:=coalesce(nullif(trim(p_body->>'title'),''),'Tanpa judul');
 v_content text:=coalesce(p_body->>'content','');
 v_pin boolean:=coalesce((p_body->>'is_pinned')::boolean,false);
 v_note jsonb; v_old integer; v_owner uuid;
begin
 if v_user is null then raise exception 'Login diperlukan'; end if;
 if p_scope not in ('PERSONAL','ROLE','MAIN') then raise exception 'Jenis catatan tidak valid'; end if;
 if p_revision is null or p_revision<0 then raise exception 'Revisi tidak valid'; end if;
 if v_status not in ('ACTIVE','ARCHIVED','DELETED') then raise exception 'Status catatan tidak valid'; end if;
 if length(v_title)>200 or length(v_content)>100000 then raise exception 'Catatan terlalu panjang'; end if;
 if p_scope='MAIN' and v_role<>'ADMIN'::public.app_role then
  raise exception 'Hanya Admin Utama yang dapat mengubah catatan utama';
 end if;
 if p_scope='ROLE' and (v_role='VIEWER'::public.app_role or not public.has_app_permission('note.write')) then
  raise exception 'Akses menulis catatan role ditolak';
 end if;
 if p_scope='PERSONAL' then
  if p_id is null then
   insert into public.personal_notes(owner_user_id,title,content,is_pinned,status,context_type,visibility,
     archived_at,deleted_at)
    values(v_user,v_title,v_content,v_pin,v_status,'PERSONAL','PRIVATE',
     case when v_status='ARCHIVED' then now() end,case when v_status='DELETED' then now() end)
    returning to_jsonb(personal_notes)||jsonb_build_object('scope','PERSONAL') into v_note;
  else
   select revision,owner_user_id into v_old,v_owner from public.personal_notes
    where id=p_id and visibility='PRIVATE' for update;
   if not found or v_owner<>v_user then raise exception 'Catatan pribadi tidak ditemukan'; end if;
   if v_old<>p_revision then raise exception 'CONFLICT: Catatan sudah diubah di perangkat lain'; end if;
   update public.personal_notes set title=v_title,content=v_content,is_pinned=v_pin,status=v_status,
    context_type='PERSONAL',visibility='PRIVATE',revision=revision+1,updated_at=now(),
    archived_at=case when v_status='ARCHIVED' then coalesce(archived_at,now()) else archived_at end,
    deleted_at=case when v_status='DELETED' then coalesce(deleted_at,now()) else deleted_at end
    where id=p_id returning to_jsonb(personal_notes)||jsonb_build_object('scope','PERSONAL') into v_note;
  end if;
 elsif p_scope='ROLE' then
  if p_id is null then
   insert into public.role_notes(owner_user_id,role_scope,title,content,is_pinned,status,archived_at,deleted_at)
    values(v_user,v_role,v_title,v_content,v_pin,v_status,
      case when v_status='ARCHIVED' then now() end,case when v_status='DELETED' then now() end)
    returning to_jsonb(role_notes)||jsonb_build_object('scope','ROLE') into v_note;
  else
   select revision,owner_user_id into v_old,v_owner from public.role_notes
    where id=p_id and role_scope=v_role for update;
   if not found then raise exception 'Catatan role tidak ditemukan'; end if;
   if v_owner<>v_user then raise exception 'Hanya pembuat yang dapat mengedit catatan role'; end if;
   if v_old<>p_revision then raise exception 'CONFLICT: Catatan sudah diubah di perangkat lain'; end if;
   update public.role_notes set title=v_title,content=v_content,is_pinned=v_pin,status=v_status,
    revision=revision+1,updated_at=now(),
    archived_at=case when v_status='ARCHIVED' then coalesce(archived_at,now()) else archived_at end,
    deleted_at=case when v_status='DELETED' then coalesce(deleted_at,now()) else deleted_at end
    where id=p_id returning to_jsonb(role_notes)||jsonb_build_object('scope','ROLE') into v_note;
  end if;
 else
  if p_id is null then
   insert into public.main_notes(owner_user_id,title,content,is_pinned,status,archived_at,deleted_at)
   values(v_user,v_title,v_content,v_pin,v_status,
      case when v_status='ARCHIVED' then now() end,case when v_status='DELETED' then now() end)
   returning to_jsonb(main_notes)||jsonb_build_object('scope','MAIN') into v_note;
  else
   select revision into v_old from public.main_notes where id=p_id for update;
   if not found then raise exception 'Catatan utama tidak ditemukan'; end if;
   if v_old<>p_revision then raise exception 'CONFLICT: Catatan sudah diubah di perangkat lain'; end if;
   update public.main_notes set title=v_title,content=v_content,is_pinned=v_pin,status=v_status,
    revision=revision+1,updated_at=now(),
    archived_at=case when v_status='ARCHIVED' then coalesce(archived_at,now()) else archived_at end,
    deleted_at=case when v_status='DELETED' then coalesce(deleted_at,now()) else deleted_at end
    where id=p_id returning to_jsonb(main_notes)||jsonb_build_object('scope','MAIN') into v_note;
  end if;
 end if;
 return v_note;
end
$function$


REVOKE ALL ON FUNCTION public.list_scope_notes(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_scope_note(text,uuid,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_scope_notes(text,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_scope_note(text,uuid,integer,jsonb) TO anon,authenticated,service_role;
COMMIT;
