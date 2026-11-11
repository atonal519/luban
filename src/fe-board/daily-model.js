/* Shared day-based planning and journal rules. No approval is inferred. */
(() => {
  const phases=[{phase:'单车',stage:4},{phase:'编组',stage:5},{phase:'灰度',stage:6},{phase:'上线',stage:8}];
  const dayDistance=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
  function agenda(packages,today,bucket='today'){
    return packages.flatMap(p=>{
      if(p.members.length&&p.members.every(r=>r.stage===8||r.workflow?.kind==='research'))return [];
      const goals=phases.flatMap(({phase,stage})=>{
        if(p.members.some(r=>r.workflow?.kind==='research'||r.workflow?.path&&!r.workflow.path.includes(stage)))return [];
        const planned=p.plans[phase]||'',candidateDates=planned?[planned]:p.planCandidates?.[phase]||[];if(!candidateDates.length)return [];
        const reached=p.members.length>0&&p.members.every(r=>r.stage>=stage&&r.stage<=8);
        const offset=planned?dayDistance(planned,today):0;
        const include=candidateDates.some(d=>{const n=dayDistance(d,today);return bucket==='today'?n===0:bucket==='overdue'?n<0&&!reached:bucket==='upcoming'?n>0&&n<=3&&!reached:bucket==='reached'?n===0&&reached:false;});
        if(!include)return [];
        const dates=p.members.map(r=>r.productionDates?.[phase]?.[phase==='上线'?'actualEnd':'actualStart']||'');
        const actual=dates.every(Boolean)?[...new Set(dates)].sort().join('、'):'';
        return [{phase,stage,planned,candidateDates,reached,actual,lateDays:Math.max(0,-offset)}];
      });
      return goals.length?[{...p,goals}]:[];
    }).sort((a,b)=>(a.goals[0].planned||a.goals[0].candidateDates[0]).localeCompare(b.goals[0].planned||b.goals[0].candidateDates[0])||a.version.localeCompare(b.version));
  }
  function saveEntry(entries,entry){
    if(!['fe','package'].includes(entry.type)||!entry.key||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!entry.actorId||!['normal','risk','blocked'].includes(entry.condition)||!entry.text?.trim()||entry.text.trim().length>500)throw new Error('请填写一句今日进展，最多 500 字。');
    const next=structuredClone(entries),prior=next.find(x=>x.type===entry.type&&x.key===entry.key&&x.date===entry.date&&x.actorId===entry.actorId);
    const value={...entry,text:entry.text.trim()};
    if(prior){
      if(prior.text!==value.text||prior.condition!==value.condition){prior.revisions||=[];prior.revisions.push({text:prior.text,condition:prior.condition,at:prior.at,actor:prior.actor});}
      Object.assign(prior,value);
    }else next.push({...value,id:crypto.randomUUID(),revisions:[]});
    return next;
  }
  window.LubanDailyModel={agenda,saveEntry,phases};
})();
