begin;
do $$ declare uid uuid;token text;begin
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.app_users(username,password_hash,role,display_name) values('__qa_v3_'||gen_random_uuid(),extensions.crypt('QA password',extensions.gen_salt('bf',4)),'ADMIN','QA rollback') returning id into uid;
 insert into public.app_sessions(user_id,token_hash,expires_at) values(uid,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '1 hour');
 perform set_config('aeroo.qa_v3',token,true);
end $$;
set local role anon;
do $$ declare n jsonb;j jsonb;blocked boolean;begin
 perform set_config('request.headers',jsonb_build_object('x-aeroo-session',current_setting('aeroo.qa_v3'))::text,true);
 n:=public.save_personal_note(null,0,'{"title":"QA Note","content":"Private"}');
 if (select count(*) from public.personal_notes where id=(n->>'id')::uuid)<>1 then raise exception 'Own note unreadable';end if;
 n:=public.save_personal_note((n->>'id')::uuid,0,'{"title":"QA Edit","content":"Updated"}');
 if (n->>'revision')::int<>1 then raise exception 'Revision missing';end if;
 blocked:=false;begin perform public.save_personal_note((n->>'id')::uuid,0,'{"title":"Conflict"}');exception when others then if sqlerrm like '%CONFLICT%' then blocked:=true;else raise;end if;end;if not blocked then raise exception 'Stale update accepted';end if;
 j:=public.save_journal(null,0,'{"journal_kind":"PENGKAJIAN","journal_date":"2026-10-06","title":"QA Study","started_at":"07:30","ended_at":"09:00","state":"COMPLETED","assessment":{"presenter":"Anwar","implementation":"Terlaksana","materials":[{"topic":"Materi A","status":"TUNTAS"}]}}','[]');
 if j->>'journal_kind'<>'PENGKAJIAN' then raise exception 'Study kind missing';end if;
 blocked:=false;begin perform public.save_journal(null,0,'{"journal_kind":"PENGKAJIAN","journal_date":"2026-10-06","title":"Invalid","started_at":"07:30","ended_at":"09:00","assessment":{}}','[]');exception when others then blocked:=true;end;if not blocked then raise exception 'Missing study data accepted';end if;
 perform set_config('request.headers','{}',true);
 if exists(select 1 from public.personal_notes) then raise exception 'Anonymous notes leak';end if;
 if exists(select 1 from public.organizational_positions) then raise exception 'Anonymous positions leak';end if;
 blocked:=false;begin perform public.save_personal_note((n->>'id')::uuid,1,'{"title":"Intrusion"}');exception when others then blocked:=true;end;if not blocked then raise exception 'Anonymous write accepted';end if;
end $$;
do $$ declare person jsonb;position jsonb;e jsonb;j jsonb;decision jsonb;blocked boolean;snapshot uuid;begin
 perform set_config('request.headers',jsonb_build_object('x-aeroo-session',current_setting('aeroo.qa_v3'))::text,true);
 person:=public.save_member(null,0,'{"name":"__QA v3 position"}','[]'::jsonb);
 position:=public.save_organizational_position(null,0,jsonb_build_object('member_id',person->>'id','title','Sekretaris','valid_from','2026-10-01'));
 if exists(select 1 from public.member_memberships where member_id=(person->>'id')::uuid) then raise exception 'Position created a synthetic program membership';end if;
 e:=public.ensure_attendance('{"title":"__QA v3 Pengurus","event_date":"2026-10-06","audience":"PENGURUS"}');
 if not exists(select 1 from public.attendance_records where event_id=(e->>'id')::uuid and member_id=(person->>'id')::uuid) then raise exception 'Position not in Pengurus roster';end if;
 j:=public.save_journal(null,0,'{"title":"__QA v3 Musyawarah","journal_date":"2026-10-06","journal_kind":"PENGURUS"}','[]');
 decision:=public.save_meeting_decision(null,0,jsonb_build_object('journal_id',j->>'id','decision','Tugas QA','pic_name','Petugas','status','OPEN'));
 blocked:=false;begin perform public.save_meeting_decision((decision->>'id')::uuid,0,jsonb_build_object('journal_id',j->>'id','decision','Tugas QA','pic_name','Petugas','status','COMPLETED'));exception when others then blocked:=true;end;if not blocked then raise exception 'Completed decision without evidence accepted';end if;
 insert into public.report_snapshots(title,period_month,period_span,dataset) values('QA snapshot','2026-10',1,'{"attendance":{"H":3}}') returning id into snapshot;
 blocked:=false;begin update public.report_snapshots set dataset='{}' where id=snapshot;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Published report mutable';end if;
 perform set_config('request.headers','{}',true);if exists(select 1 from public.report_snapshots where id=snapshot) then raise exception 'Published report leaked';end if;
end $$;
do $$ declare j jsonb;e jsonb;g jsonb;decision jsonb;blocked boolean;begin
 perform set_config('request.headers',jsonb_build_object('x-aeroo-session',current_setting('aeroo.qa_v3'))::text,true);
 g:=public.save_agenda(null,0,'[{"title":"__QA lock","starts_at":"2026-10-06T00:30:00Z","audience":"PENGURUS","attendance_enabled":true}]','this');
 e:=public.ensure_attendance(jsonb_build_object('agenda_id',g->0->>'id'));
 j:=public.save_journal(null,0,jsonb_build_object('title','__QA locked journal','journal_date','2026-10-06','journal_kind','PENGURUS','event_id',e->>'id','agenda_id',g->0->>'id'),'[]');
 decision:=public.save_meeting_decision(null,0,jsonb_build_object('journal_id',j->>'id','decision','Locked task','pic_name','QA'));
 perform public.save_agenda((g->0->>'id')::uuid,0,jsonb_build_array(jsonb_build_object('title','__QA lock','starts_at','2026-10-06T00:30:00Z','audience','PENGURUS','attendance_enabled',true,'status','LOCKED')),'this');
 blocked:=false;begin perform public.save_journal((j->>'id')::uuid,0,jsonb_build_object('title','Unauthorized detach','journal_date','2026-10-06','journal_kind','PENGURUS','event_id',null,'agenda_id',null),'[]');exception when others then blocked:=true;end;if not blocked then raise exception 'Locked journal detached';end if;
 blocked:=false;begin perform public.save_meeting_decision((decision->>'id')::uuid,0,jsonb_build_object('journal_id',j->>'id','decision','Changed','pic_name','QA'));exception when others then blocked:=true;end;if not blocked then raise exception 'Locked decision modified';end if;
end $$;
do $$ declare person jsonb;p jsonb;blocked boolean;begin
 perform set_config('request.headers',jsonb_build_object('x-aeroo-session',current_setting('aeroo.qa_v3'))::text,true);
 person:=public.save_member(null,0,'{"name":"__QA term preservation"}','[]'::jsonb);
 p:=public.save_organizational_position(null,0,jsonb_build_object('member_id',person->>'id','title','Sekretaris','valid_from','2026-10-01'));
 blocked:=false;begin perform public.save_organizational_position((p->>'id')::uuid,0,jsonb_build_object('member_id',person->>'id','title','Sekretaris','valid_from','2026-10-02'));exception when others then blocked:=true;end;if not blocked then raise exception 'Historical term start rewritten';end if;
 p:=public.save_organizational_position((p->>'id')::uuid,0,jsonb_build_object('member_id',person->>'id','title','Sekretaris','valid_from','2026-10-01','valid_to','2026-10-02'));
 if exists(select 1 from public.member_categories mc join public.categories c on c.id=mc.category_id where mc.member_id=(person->>'id')::uuid and c.slug='pengurus') then raise exception 'Expired position category stale';end if;
 if not exists(select 1 from public.position_revisions where position_id=(p->>'id')::uuid) then raise exception 'Position revision history missing';end if;
end $$;
select 'PASS: notes ownership/conflict, study, positions/roster, decision evidence, immutable report, anonymous boundaries, lock bypass rejection' as result;
rollback;
