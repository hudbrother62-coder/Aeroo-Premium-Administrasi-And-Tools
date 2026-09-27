drop policy if exists report_templates_write on public.report_templates;
create policy report_templates_write on public.report_templates for all to authenticated, anon
  using (public.current_app_role() in ('ADMIN'::public.app_role,'DEWAN_GURU'::public.app_role))
  with check (public.current_app_role() in ('ADMIN'::public.app_role,'DEWAN_GURU'::public.app_role));
