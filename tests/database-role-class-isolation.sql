begin;

create temporary table qcl_role_classes as
select id,name,row_number() over(order by sort_order,name) rn
from public.classes where audience='CABERAWIT' and active;
grant select on qcl_role_classes to anon;

insert into public.app_users(id,username,password_hash,display_name,role,active)
values('11111111-1111-4111-8111-111111111111','qcl-role-fixture','fixture-hash','QCL Dewan Guru','DEWAN_GURU',true);

insert into public.app_sessions(user_id,token_hash,expires_at)
values(
 '11111111-1111-4111-8111-111111111111',
 encode(extensions.digest('qcl-class-token','sha256'),'hex'),
 now()+interval '10 minutes'
);

insert into public.user_class_scopes(user_id,class_id,can_read,can_write)
select '11111111-1111-4111-8111-111111111111',id,true,true
from qcl_role_classes where rn=1;

select set_config('request.headers','{"x-aeroo-session":"qcl-class-token"}',true);

do $$
declare
  own_class uuid:=(select id from qcl_role_classes where rn=1);
  other_class uuid:=(select id from qcl_role_classes where rn=2);
  cab_category uuid:=(select id from public.categories where slug='caberawit');
  created jsonb;
  failed boolean:=false;
begin
  if public.current_app_role()<>'DEWAN_GURU'::public.app_role then raise exception 'FAIL: fixture role'; end if;
  if public.can_read_audience_global('CABERAWIT'::public.audience_type) then raise exception 'FAIL: class teacher became global'; end if;
  if not public.can_read_audience('CABERAWIT'::public.audience_type) then raise exception 'FAIL: Caberawit menu scope missing'; end if;
  if not public.can_read_caberawit_class(own_class) then raise exception 'FAIL: own class denied'; end if;
  if public.can_read_caberawit_class(other_class) then raise exception 'FAIL: other class leaked'; end if;

  created:=public.save_member(
    null,0,
    jsonb_build_object('name','QCL Anak Kelas Sendiri','gender','L'),
    jsonb_build_array(jsonb_build_object('category_id',cab_category,'class_id',own_class,'valid_from',(now() at time zone 'Asia/Jakarta')::date))
  );
  if created->>'id' is null then raise exception 'FAIL: own class member create failed'; end if;

  begin
    perform public.save_member(
      null,0,
      jsonb_build_object('name','QCL Anak Kelas Lain','gender','L'),
      jsonb_build_array(jsonb_build_object('category_id',cab_category,'class_id',other_class,'valid_from',(now() at time zone 'Asia/Jakarta')::date))
    );
  exception when others then
    failed:=position('Kelas Caberawit di luar akses' in sqlerrm)>0;
  end;
  if not failed then raise exception 'FAIL: cross-class member create was not blocked'; end if;

  created:=public.save_context_note(null,0,jsonb_build_object(
    'title','Catatan kelas sendiri','content','fixture','visibility','ACCESS','context_type','CLASS','class_id',own_class
  ));
  if created->>'id' is null then raise exception 'FAIL: own class access note failed'; end if;

  failed:=false;
  begin
    perform public.save_context_note(null,0,jsonb_build_object(
      'title','Catatan kelas lain','content','fixture','visibility','ACCESS','context_type','CLASS','class_id',other_class
    ));
  exception when others then
    failed:=position('Kelas catatan di luar akses' in sqlerrm)>0;
  end;
  if not failed then raise exception 'FAIL: cross-class note was not blocked'; end if;
end $$;

set local role anon;

select 1 / case when (
  select count(*)=1 from public.classes where audience='CABERAWIT'
) then 1 else 0 end as class_rls_guard;

select 1 / case when not exists(
  select 1
  from public.members m
  join public.member_memberships mm on mm.member_id=m.id
  join public.categories c on c.id=mm.category_id and c.slug='caberawit'
  where mm.class_id<>(select id from qcl_role_classes where rn=1)
) then 1 else 0 end as member_rls_guard;

reset role;

select 'PASS: class-scoped Dewan Guru cannot read/write another Caberawit class and scoped notes follow context access' result;
rollback;
