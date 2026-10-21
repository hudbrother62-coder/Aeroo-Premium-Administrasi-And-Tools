import IndividualAttendanceDetail from '@/components/IndividualAttendanceDetail';
export default async function IndividualPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return <main className="attendancePage"><IndividualAttendanceDetail personId={id}/></main>;
}
