/* One package keeps its full membership and stage when the visible FE list is filtered. */
(() => {
  const order=['stage-10','stage-0','stage-1','stage-2','preparing','mixed','stage-3','stage-4','stage-5','stage-6','stage-7','stage-8','stage-9','stage-11','stage-12','stage-13','stage-14','unassigned'];
  function packageState(members){
    const codes=[...new Set(members.map(r=>r.stage))];
    const stage=codes.length===1?codes[0]:null;
    const mixed=codes.length>1,ready=members.length>0&&members.every(r=>r.stage<=8&&(r.stage>=3||r.workflow?.kind==='release'&&Array.isArray(r.workflow.path)&&!r.workflow.path.includes(3)));
    return {stage,mixed,ready,key:mixed?(ready?'mixed-'+codes.slice().sort((a,b)=>a-b).join('-'):'preparing'):'stage-'+stage};
  }
  function groups(records,visible){
    const all=new Map(),shown=new Map(),unassigned=[];
    records.forEach(r=>{if(r.version){if(!all.has(r.version))all.set(r.version,[]);all.get(r.version).push(r);}});
    visible.forEach(r=>{
      if(!r.version){unassigned.push(r);return;}
      if(!shown.has(r.version))shown.set(r.version,[]);shown.get(r.version).push(r);
    });
    const stages=new Map();
    shown.forEach((members,version)=>{
      const full=all.get(version)||members,fact=packageState(full);
      if(!stages.has(fact.key))stages.set(fact.key,{key:fact.key,stage:fact.stage,packages:[],unassigned:[]});
      stages.get(fact.key).packages.push({version,members,total:full.length,...fact});
    });
    if(unassigned.length)stages.set('unassigned',{key:'unassigned',stage:null,packages:[],unassigned});
    const rank=key=>order.indexOf(key.startsWith('mixed-')?'mixed':key);
    return [...stages.values()].sort((a,b)=>rank(a.key)-rank(b.key));
  }
  window.LubanGrouping={packageState,groups};
})();
