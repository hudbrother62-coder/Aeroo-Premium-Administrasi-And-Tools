import {redirect} from 'next/navigation';
// The former multi-step wizard has been retired in favor of free-text journaling.
export default function JournalQuickRedirect(){redirect('/jurnal/tulis');}
