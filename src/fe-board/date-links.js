/* Neighbouring dates are defaults. Explicit dates remain independent facts. */
(() => {
  const names={single:'单车',group:'编组',gray:'灰度',launch:'上线'};
  const phases=['demand','development','testing','production'];
  const fields=['expectedStart','expectedEnd','actualStart','actualEnd'];
  const groups=[];
  for(const kind of ['expected','actual']){
    const start=kind+'Start',end=kind+'End';
    groups.push(['phase.development.'+start,'phase.demand.'+end]);
    groups.push(['phase.testing.'+start,'phase.development.'+end]);
    groups.push([kind==='expected'?'plan.单车':'production.single.actualStart','phase.production.'+start,'phase.testing.'+end]);
    groups.push([kind==='expected'?'plan.编组':'production.group.actualStart','production.single.'+end]);
    groups.push([kind==='expected'?'plan.灰度':'production.gray.actualStart','production.group.'+end]);
    groups.push(kind==='expected'?['plan.上线','phase.production.expectedEnd','production.gray.expectedEnd','production.launch.expectedEnd']:['production.launch.actualEnd','production.launch.actualStart','phase.production.actualEnd','production.gray.actualEnd']);
  }
  const groupFor=path=>groups.find(g=>g.includes(path));
  function init(r){
    r.phaseDates||={};r.productionDates||={};r.productionPlans||={};r.dateLinks||={};
    phases.forEach(p=>{r.phaseDates[p]||={};fields.forEach(f=>r.phaseDates[p][f]??='');});
    Object.values(names).forEach(p=>{r.productionDates[p]||={};['expectedEnd','actualStart','actualEnd'].forEach(f=>r.productionDates[p][f]??='');r.productionPlans[p]??='';});
  }
  function get(r,path){
    const [type,id,field]=path.split('.');
    if(type==='phase')return r.phaseDates?.[id]?.[field]||'';
    if(type==='production')return r.productionDates?.[names[id]]?.[field]||'';
    if(type==='plan')return r.productionPlans?.[id]||'';
    return r[path]||'';
  }
  function set(r,path,value){
    const [type,id,field]=path.split('.');
    if(type==='phase')r.phaseDates[id][field]=value;
    else if(type==='production')r.productionDates[names[id]][field]=value;
    else if(type==='plan')r.productionPlans[id]=value;
    else r[path]=value;
  }
  const isAuto=(r,path)=>r.dateLinks?.[path]?.mode==='auto';
  function applicable(r,path){if(r.workflow?.kind==='research')return false;const selected=r.workflow?.path;if((r.flowVisits||[]).length&&/^production\.launch\.actual/.test(path))return false;if(!Array.isArray(selected))return true;const [type,id]=path.split('.');if(type==='phase'){if(id==='production')return selected.some(s=>[4,5,6,8].includes(s));if(id==='development')return selected.some(s=>s===1||s===2);return selected.includes(({demand:10,testing:3})[id]);}const stage=type==='plan'?({单车:4,编组:5,灰度:6,上线:8})[id]:({single:4,group:5,gray:6,launch:8})[id];return stage===undefined||selected.includes(stage);}
  function resolve(r){
    init(r);
    if(r.workflow?.kind==='research')return r;
    if(!r.productionPlans['上线']&&r.launchDate)r.productionPlans['上线']=r.launchDate;
    if(!r.launchDate&&r.productionPlans['上线'])r.launchDate=r.productionPlans['上线'];
    for(const original of groups){
      if((r.flowVisits||[]).length&&original.some(path=>path.includes('.actual')))continue;
      const group=original.filter(path=>applicable(r,path));
      const anchor=group.find(path=>get(r,path)&&!isAuto(r,path));
      for(const path of group){
        const meta=r.dateLinks[path];
        if(meta?.mode==='auto'){
          // A saved automatic field points directly to an explicit source.
          // Never turn automatic fields into a cycle or guess a duration.
          set(r,path,group.includes(meta.source)&&!isAuto(r,meta.source)?get(r,meta.source):'');
        }else if(!meta&&anchor&&path!==anchor&&(!get(r,path)||get(r,path)===get(r,anchor))){
          r.dateLinks[path]={mode:'auto',source:anchor,priorValue:get(r,path)};set(r,path,get(r,anchor));
        }
      }
    }
    return r;
  }
  function edit(r,path,value){
    init(r);set(r,path,value);r.dateLinks[path]={mode:'manual'};
    if(path==='launchDate'||path==='plan.上线'){
      r.launchDate=value;r.productionPlans['上线']=value;r.dateLinks['plan.上线']={mode:'manual'};
    }
    return resolve(r);
  }
  function sourceFor(r,path){
    const group=groupFor(path);
    return group?.find(p=>p!==path&&get(r,p)&&!isAuto(r,p))||'';
  }
  function restore(r,path){
    init(r);const source=sourceFor(r,path);
    if(source){r.dateLinks[path]={mode:'auto',source};set(r,path,get(r,source));}
    else{delete r.dateLinks[path];set(r,path,'');}
    return resolve(r);
  }
  function label(path){
    const [type,id,field]=path.split('.');
    if(type==='plan')return id+'计划进入';
    if(type==='releaseConfirmedDate')return '研发上线确认完成日期';
    if(type==='launchDate')return '计划上线';
    const stage=type==='phase'?({demand:'需求',development:'开发',testing:'测试',production:'生产'})[id]:names[id];
    return stage+({expectedStart:'计划进入',expectedEnd:'计划离开',actualStart:'实际进入',actualEnd:'实际离开'})[field];
  }
  window.LubanDateLinks={resolve,edit,restore,get,isAuto,sourceFor,label,paths:[...new Set(groups.flat())],material:(r,path)=>isAuto(r,path)?'':get(r,path),reviewValue:(r,path)=>isAuto(r,path)?r.dateLinks[path].priorValue||'':get(r,path)};
})();
