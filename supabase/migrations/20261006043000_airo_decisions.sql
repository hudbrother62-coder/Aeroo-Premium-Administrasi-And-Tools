create table public.meeting_decisions (
 id uuid primary key default gen_random_uuid(),journal_id uuid not null references public.journals(id),decision text not null check(length(trim(decision))>0),
 pic_member_id uuid references public.members(id),pic_name text not null,deadline date,
 status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
 evidence text not null default '',notes text not null default '',revision integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status<>'COMPLETED' or length(trim(evidence))>0)
);
alter table public.meeting_decisions enable row level security;
create index meeting_decisions_journal on public.meeting_decisions(journal_id);
revoke all on public.meeting_decisions from anon,authenticated;
grant select on public.meeting_decisions to anon,authenticated;
create policy decisions_read on public.meeting_decisions for select to anon,authenticated using((select public.current_app_role()) in ('ADMIN','KELOMPOK') and public.can_write_journal_id(journal_id));
create or replace function public.save_meeting_decision(p_id uuid,p_revision integer,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.meeting_decisions%rowtype;old_r public.meeting_decisions%rowtype;j uuid;pic uuid;name text;begin
 if public.current_app_role() is null or public.current_app_role() not in ('ADMIN','KELOMPOK') then raise exception 'Akses keputusan ditolak';end if;
 if p_revision is null or p_revision<0 then raise exception 'Revisi tidak valid';end if;
 j:=(p_body->>'journal_id')::uuid;
 if not exists(select 1 from public.journals where id=j and journal_kind='PENGURUS' and state<>'ARCHIVED') or not public.can_write_journal_id(j) then raise exception 'Musyawarah tidak tersedia';end if;
 pic:=nullif(p_body->>'pic_member_id','')::uuid;name:=trim(coalesce(p_body->>'pic_name',''));
 if pic is not null then select members.name into name from public.members where id=pic;if not found then raise exception 'PIC tidak ditemukan';end if;end if;
 if name='' then raise exception 'PIC wajib diisi';end if;
 if p_id is not null then select * into old_r from public.meeting_decisions where id=p_id for update;if not found or old_r.journal_id<>j then raise exception 'Keputusan tidak ditemukan';end if;if old_r.revision<>p_revision then raise exception 'CONFLICT: Keputusan sudah diubah';end if;end if;
 if p_id is null then insert into public.meeting_decisions(journal_id,decision,pic_member_id,pic_name,deadline,status,evidence,notes) values(j,p_body->>'decision',pic,name,nullif(p_body->>'deadline','')::date,coalesce(p_body->>'status','OPEN'),coalesce(p_body->>'evidence',''),coalesce(p_body->>'notes','')) returning * into r;
 else update public.meeting_decisions set decision=p_body->>'decision',pic_member_id=pic,pic_name=name,deadline=nullif(p_body->>'deadline','')::date,status=coalesce(p_body->>'status','OPEN'),evidence=coalesce(p_body->>'evidence',''),notes=coalesce(p_body->>'notes',''),revision=revision+1,updated_at=now() where id=p_id returning * into r;end if;
 return to_jsonb(r);
end $$;
revoke all on function public.save_meeting_decision(uuid,integer,jsonb) from public;
grant execute on function public.save_meeting_decision(uuid,integer,jsonb) to anon,authenticated;
