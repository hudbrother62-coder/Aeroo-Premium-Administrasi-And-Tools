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
  if ct<>'PERSONAL' and not public.has_app_permission('note.write') then raise exception 'Akses menulis catatan ditolak'; end if;

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
  elsif target_member is not null then allowed:=public.can_write_member(target_member);
  elsif target_event is not null then allowed:=public.can_write_event(target_event);
  elsif target_journal is not null then allowed:=public.can_write_journal_id(target_journal);
  elsif target_agenda is not null then select public.can_write_scoped_audience(a.audience,a.class_id) into allowed from public.agenda a where a.id=target_agenda;
  elsif target_class is not null then select public.can_write_scoped_audience(c.audience,c.id) into allowed from public.classes c where c.id=target_class;
  elsif target_audience is not null then allowed:=public.can_write_audience(target_audience);
  else allowed:=public.current_app_role()='ADMIN'::public.app_role;
  end if;
  if not coalesce(allowed,false) then raise exception 'Konteks catatan di luar akses tulis'; end if;

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
