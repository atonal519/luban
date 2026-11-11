/* Read-only projection: a date reminds; an explicit workflow request collects. */
(() => {
  const W=window.LubanWorkflow;
  const stagePeriod=stage=>({1:'development',3:'testing',4:'single',5:'group',6:'gray',8:'launch',13:'development',14:'testing'})[stage]||'';
  function present(records,record,period,today){
    const reached=['past','current','completed'].includes(period.state),research=W.definition(record).kind==='research';
    const primary={kind:reached?'actual':'plan',date:reached?period.actualStart||'':period.start||''};
    const secondary=reached?(period.start&&period.start!==primary.date?{kind:'plan',date:period.start}:null):(period.actualStart?{kind:'actual',date:period.actualStart}:null);
    const due=period.start===today&&!reached;
    const result={primary,secondary,today:due,status:'',label:'',requestId:'',action:''};
    if(research){if(due)result.action='处理';return result;}
    const nextPeriod=stagePeriod(W.target(records,record.id));
    const active=W.active(records,record.id);
    const latest=records.flatMap(r=>r.flowRequests||[]).filter(q=>q.memberIds.includes(record.id)).sort((a,b)=>String(a.closedAt||a.completedAt||a.createdAt||'').localeCompare(String(b.closedAt||b.completedAt||b.createdAt||''))).at(-1);
    const request=active||latest?.status==='rejected'&&stagePeriod(latest.target)===nextPeriod&&latest;
    if(request&&stagePeriod(request.target)===period.id){
      const ready=W.readiness(records,request),blocked=request.status==='rejected'||ready.stale||request.tasks.some(t=>t.status==='rejected'||t.status==='submitted'&&t.context!==W.taskContext(records,request,t.role));
      result.status=blocked?'blocked':ready.ready?'ready':'collecting';
      result.label=({blocked:'待处理',ready:'待 PM 确认',collecting:'收集中'})[result.status];result.requestId=request.id;result.action='处理';
    }else if(due)result.action=nextPeriod===period.id?'发起':'处理';
    return result;
  }
  window.LubanStageCells={present,stagePeriod};
})();
