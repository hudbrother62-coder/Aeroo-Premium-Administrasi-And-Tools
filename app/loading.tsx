export default function Loading(){
  return <div className="routeLoading" aria-label="Memuat">
    <div className="skeleton heroSkeleton"/>
    <div className="metricGrid">
      {Array.from({length:4}).map((_,i)=><div className="skeleton metricSkeleton" key={i}/>)}
    </div>
    <div className="skeleton panelSkeleton"/>
  </div>;
}
