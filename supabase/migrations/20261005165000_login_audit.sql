create or replace function public.login_app_audited(p_username text,p_password text,p_ip_hash text default null,p_user_agent text default null)
returns table(token text,user_id uuid,username text,display_name text,role public.app_role,expires_at timestamptz)
language plpgsql security definer set search_path='' set row_security=off as $$
declare u public.app_users%rowtype;v_token text;v_expires timestamptz:=now()+interval '7 days';v_fail integer;v_success boolean:=false;begin
 if p_username is null or length(trim(p_username))=0 or length(p_username)>100 or p_password is null or length(p_password)=0 or length(p_password)>512 then return;end if;
 select * into u from public.app_users a where lower(a.username)=lower(trim(p_username)) limit 1 for update;
 if u.id is not null and u.active and (u.locked_until is null or u.locked_until<=now()) then
 if extensions.crypt(p_password,u.password_hash)=u.password_hash then v_success:=true;
 update public.app_users set failed_attempts=0,locked_until=null,updated_at=now() where id=u.id;
 delete from public.app_sessions s where s.expires_at<=now();
 v_token:=encode(extensions.gen_random_bytes(32),'hex');insert into public.app_sessions(user_id,token_hash,expires_at) values(u.id,encode(extensions.digest(v_token,'sha256'),'hex'),v_expires);
 else v_fail:=case when u.locked_until is not null and u.locked_until<=now() then 1 else coalesce(u.failed_attempts,0)+1 end;
 update public.app_users set failed_attempts=v_fail,locked_until=case when v_fail>=5 then now()+interval '10 minutes' end,updated_at=now() where id=u.id;
 end if;end if;
 insert into public.login_history(user_id,username,success,ip_hash,user_agent) values(u.id,left(trim(p_username),100),v_success,left(p_ip_hash,64),left(p_user_agent,500));
 if v_success then return query select v_token,u.id,u.username,u.display_name,u.role,v_expires;end if;
end $$;
revoke all on function public.login_app(text,text),public.record_login_event(text,boolean,text,text) from public,anon,authenticated;
revoke all on function public.login_app_audited(text,text,text,text) from public;grant execute on function public.login_app_audited(text,text,text,text) to anon,authenticated;
