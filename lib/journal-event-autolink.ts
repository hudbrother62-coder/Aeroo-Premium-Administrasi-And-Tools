import 'server-only';
import {db} from '@/lib/supabase-server';
import {journalAudience,uniqueJournalEvent,type JournalLinkInput,type JournalEventCandidate} from './journal-event-link';

/** Attach only a unique exact same-day activity/session. Never guess by title alone. */
export async function linkJournalToUniqueAttendance(
 s:Awaited<ReturnType<typeof db>>,body:Record<string,unknown>
):Promise<Record<string,unknown>>{
 if(body.event_id)return body; // Explicit selection wins.
 const input:JournalLinkInput={
   journal_kind:typeof body.journal_kind==='string'?body.journal_kind:null,
   journal_date:typeof body.journal_date==='string'?body.journal_date:null,
   class_id:typeof body.class_id==='string'&&body.class_id?body.class_id:null,
   activity_type_id:typeof body.activity_type_id==='string'&&body.activity_type_id?body.activity_type_id:null,
   agenda_id:typeof body.agenda_id==='string'&&body.agenda_id?body.agenda_id:null
 };
 const audience=journalAudience(input.journal_kind);
 if(!audience||!input.journal_date||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.journal_date)
   ||(!input.agenda_id&&!input.activity_type_id))return body;
 let q=s.from('attendance_events')
   .select('id,event_date,audience,state,class_id,agenda_id,activity_type_id')
   .eq('event_date',input.journal_date).eq('audience',audience).neq('state','CANCELLED');
 q=input.class_id?q.eq('class_id',input.class_id):q.is('class_id',null);
 if(input.agenda_id)q=q.eq('agenda_id',input.agenda_id);
 else q=q.is('agenda_id',null).eq('activity_type_id',input.activity_type_id!);
 const {data,error}=await q.limit(2);
 if(error)throw new Error('Gagal memeriksa presensi terkait: '+error.message);
 const eventId=uniqueJournalEvent(input,(data||[]) as JournalEventCandidate[]);
 return eventId?{...body,event_id:eventId}:body;
}
