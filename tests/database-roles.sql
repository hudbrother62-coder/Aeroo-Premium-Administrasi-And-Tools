begin;
do $$ declare r public.app_role;uid uuid;token text;begin
 foreach r in array array['DEWAN_GURU','KELOMPOK','VIEWER']::public.app_role[] loop
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.app_users(username,password_hash,role,display_name) values('__qa_role_'||gen_random_uuid(),extensions.crypt('QA password',extensions.gen_salt('bf',4)),r,'QA rollback') returning id into uid;
 insert into public.app_sessions(user_id,token_hash,expires_at) values(uid,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '1 hour');
 perform set_config('aeroo.qa_'||lower(r::text),token,true);
 end loop;
 perform set_config('aeroo.qa_ibu',(select id::text from public.categories where slug='ibu-ibu'),true);perform set_config('aeroo.qa_cab',(select id::text from public.categories where slug='caberawit'),true);
end $$;
set local role anon;
do $$ declare cat uuid;cab uuid;person jsonb;blocked boolean;r public.app_role;begin
 cat:=current_setting('aeroo.qa_ibu')::uuid;cab:=current_setting('aeroo.qa_cab')::uuid;
 perform set_config('request.headers',jsonb_build_object('x-aeroo-session',current_setting('aeroo.qa_kelompok'))::text,true);
 person:=public.save_member(null,0,'{"name":"__QA Ibu"}',jsonb_build_array(jsonb_build_object('category_id',cat)));
 blocked:=false;begin perform public.save_member(null,0,'{"name":"__QA Cab invalid"}',jsonb_build_array(jsonb_build_object('category_id',cab)));exception when others then blocked:=true;end;if not blocked then raise exception 'Kelompok can write Caberawit';end if;
 perform set_config('request.headers',jsonb_build_object('x-aeroo-session',current_setting('aeroo.qa_dewan_guru'))::text,true);
 blocked:=false;begin perform public.save_member(null,0,'{"name":"__QA Ibu invalid"}',jsonb_build_array(jsonb_build_object('category_id',cat)));exception when others then blocked:=true;end;if not blocked then raise exception 'Dewan can write Ibu-Ibu';end if;
 blocked:=false;begin perform public.ensure_attendance('{"title":"__QA Pengurus invalid","event_date":"2026-10-05","audience":"PENGURUS"}');exception when others then blocked:=true;end;if not blocked then raise exception 'Dewan can write Pengurus';end if;
 perform set_config('request.headers',jsonb_build_object('x-aeroo-session',current_setting('aeroo.qa_viewer'))::text,true);
 if exists(select 1 from public.members) or exists(select 1 from public.attendance_events) or exists(select 1 from public.journals) then raise exception 'Viewer can read raw private records';end if;
 blocked:=false;begin perform public.save_member(null,0,'{"name":"__QA Viewer invalid"}',jsonb_build_array(jsonb_build_object('category_id',cat)));exception when others then blocked:=true;end;if not blocked then raise exception 'Viewer can write';end if;
 if not exists(select 1 from jsonb_array_elements(public.viewer_data('members')) el where el->>'id'=person->>'id') then raise exception 'Allowed Ibu viewer projection missing';end if;
 if public.viewer_data('members')::text like '%"phone"%' or public.viewer_data('members')::text like '%"office"%' or public.viewer_data('categories')::text like '%pengurus%' then raise exception 'Viewer private context leaked';end if;
end $$;
select 'PASS: Dewan, Kelompok, Viewer boundaries' as result;
rollback;
