-- Groq ciphertext is accessible to the server for authenticated journal writers,
-- while the encryption master key remains only in Vercel environment variables.
create or replace function public.get_groq_provider_config()
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare v jsonb;
begin
  if public.current_app_user_id() is null or public.current_app_role()='VIEWER' then
    return '{}'::jsonb;
  end if;
  select value into v from public.app_settings where key='groq_provider';
  return coalesce(v,'{}'::jsonb);
end $$;
revoke all on function public.get_groq_provider_config() from public;
grant execute on function public.get_groq_provider_config() to anon,authenticated;
