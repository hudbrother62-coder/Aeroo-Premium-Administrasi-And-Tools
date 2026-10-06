begin;
do $$ declare uid uuid; token text; cat uuid; person jsonb; begin
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.app_users(username,password_hash,role,display_name) values('__qa_legacy_'||gen_random_uuid(),extensions.crypt('QA password',extensions.gen_salt('bf',4)),'DEWAN_GURU','QA rollback') returning id into uid;
 insert into public.app_sessions(user_id,token_hash,expires_at) values(uid,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '1 hour');
 perform set_config('aeroo.qa_legacy',token,true);
 select id into cat from public.categories where slug='muda-mudi';
 insert into public.members(name) values('__QA legacy visibility') returning id into uid;
 insert into public.member_memberships(member_id,category_id,valid_from,active) values(uid,cat,(now() at time zone 'Asia/Jakarta')::date,true);
 perform set_config('aeroo.qa_person',uid::text,true);
 insert into public.user_permissions(user_id,permission,allowed) select user_id,'person.read',false from public.app_sessions where token_hash=encode(extensions.digest(token,'sha256'),'hex');
end $$;
set local role anon;
do $$ declare blocked boolean:=false; begin
 perform set_config('request.headers','{}',true);
 begin perform public.create_muda_mudi_member('{"name":"__QA anonymous legacy"}');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Anonymous legacy creation accepted';end if;
 perform set_config('request.headers',jsonb_build_object('x-aeroo-session',current_setting('aeroo.qa_legacy'))::text,true);
 if exists(select 1 from public.members where id=current_setting('aeroo.qa_person')::uuid) then raise exception 'Revoked person permission ignored';end if;
 if exists(select 1 from public.member_memberships where member_id=current_setting('aeroo.qa_person')::uuid) then raise exception 'Membership visible despite revoked person.read';end if;
end $$;
reset role;
update public.user_permissions set allowed=true where permission='person.read' and user_id=(select user_id from public.app_sessions where token_hash=encode(extensions.digest(current_setting('aeroo.qa_legacy'),'sha256'),'hex'));
set local role anon;
do $$ declare mid uuid; begin
 mid:=public.create_muda_mudi_member('{"name":"__QA authenticated legacy"}');
 if not exists(select 1 from public.member_memberships where member_id=mid) then raise exception 'Legacy member missing temporal membership';end if;
end $$;
select 'PASS: legacy anonymous guard, granular read isolation, temporal creation' as result;
rollback;
