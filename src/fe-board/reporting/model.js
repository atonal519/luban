/* Local reporting ledger. No outbound transport and no automatic state transition. */
(() => {
  const copy=x=>structuredClone(x),initial=()=>({version:1,submissions:[],changes:[],reports:[]});
  const normalize=s=>({version:1,submissions:copy(s?.submissions||[]),changes:copy(s?.changes||[]),reports:copy(s?.reports||[])});
  const names=value=>[...new Set(String(value||'').split(/[,，、;；\n]/).map(s=>s.trim()).filter(s=>s&&!['—','未填','待指定'].includes(s)))];
  const active=r=>[1,2,3,4,5,6,7,10,13].includes(r.stage);
  const assignments=records=>records.filter(active).flatMap(r=>[...new Set([...names(r.owner),...names(r.testOwner)])].map(person=>({feId:r.id,person,role:names(r.testOwner).includes(person)?'测试':'研发'})));
  const personId=p=>'person-'+encodeURIComponent(p);
  const facts=(records,daily,date)=>({date,items:records.filter(active).map(r=>({id:r.id,title:r.title,version:r.version||'',stage:r.stage,owner:r.owner||'',testOwner:r.testOwner||'',plans:copy(r.productionPlans||{}),updates:copy(daily.filter(d=>d.key===r.id&&d.date===date)),latestSource:copy(daily.filter(d=>d.key===r.id&&d.origin==='workbook').sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null)}))});
  const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
  function parsePlan(r,text,today){
    const m=String(text).match(/(提测|测试|单车|编组|灰度|上线)(?:阶段)?\s*(?:的)?\s*(?:计划|排期)(?:日期|进入)?\s*(?:改到|改为|调整到|调整为|延期到|提前到|设为|是|到|为)\s*(?:(20\d{2})[-年\/])?(\d{1,2})[-月\/](\d{1,2})日?/);
    if(!m)return [];
    const day=(m[2]||today.slice(0,4))+'-'+m[3].padStart(2,'0')+'-'+m[4].padStart(2,'0');if(!validDate(day))throw Error('这条日期无效，请修改后再预览');
    if(r.workflow?.kind==='research')throw Error('研究任务请在阶段日期中修改开始与结束日期');
    const phase=m[1],code=({单车:4,编组:5,灰度:6,上线:8})[phase];if(code&&r.workflow?.path&&!r.workflow.path.includes(code))throw Error('这个FE不使用该阶段，请选择适用阶段');
    const path=['测试','提测'].includes(phase)?'phase.testing.expectedStart':'plan.'+phase;
    return [{path,label:phase+'当前排期',value:day}];
  }
  const read=(r,path)=>path==='phase.testing.expectedStart'?r.phaseDates?.testing?.expectedStart||'':r.productionPlans?.[path.slice(5)]||'';
  function apply(input,inputRecords,inputDaily,a,ctx){
    const reporting=normalize(input),records=copy(inputRecords),daily=copy(inputDaily),actor=ctx.actor||{},at=ctx.at,today=ctx.today;
    const uid=p=>p+'-'+ctx.uid(),check=(ok,msg)=>{if(!ok)throw Error(msg);},get=id=>{const r=records.find(r=>r.id===id);check(r,'FE已不存在，请刷新后重试');return r;};
    const supervisor=actor.kind==='creator'||actor.kind==='pm',editable=r=>actor.kind==='creator'||!!ctx.canEdit?.(r);
    const result=()=>({reporting,records,daily});
    if(a.type==='submit'){
      const person=String(a.person||'').trim();check(person,'请选择填报人');check(supervisor||person===actor.name,'只能填写本人的进展');
      check(['platform','robot-preview',undefined].includes(a.channel),'未知填报渠道');check(Array.isArray(a.entries)&&a.entries.length,'请选择本次要保存的条目');
      const seen=new Set();for(const entry of a.entries){const r=get(entry.feId);check(!supervisor||editable(r),'只能代录自己负责范围内的FE');check(!seen.has(r.id),'同一FE请只填写一次');seen.add(r.id);check(assignments([r]).some(x=>x.person===person),'该填报人不在此FE的研发或测试名单中');check(supervisor||active(r),'当前任务已不在填报范围');check(String(entry.text??'').length<=30000,'单条内容最多30000字，请分次记录');}
      for(const entry of a.entries){
        const r=get(entry.feId),prior=reporting.submissions.find(s=>s.feId===r.id&&s.person===person&&s.date===today),revisions=copy(prior?.revisions||[]);
        if(prior){const prev=copy(prior);delete prev.revisions;revisions.push(prev);}
        const next={id:prior?.id||uid('reply'),feId:r.id,person,date:today,text:String(entry.text??''),risk:entry.risk===true,channel:a.channel||'platform',at,recordedBy:actor.id,recorder:actor.name,revisions};
        if(prior)Object.assign(prior,next);else reporting.submissions.push(next);
        const actorId=personId(person),old=daily.find(d=>d.type==='fe'&&d.key===r.id&&d.date===today&&d.actorId===actorId),past=copy(old?.revisions||[]);
        if(old){const prev=copy(old);delete prev.revisions;past.push(prev);}
        const item={id:old?.id||uid('daily'),type:'fe',key:r.id,date:today,text:next.text,condition:next.risk?'risk':'normal',actorId,actor:person,at,recordedBy:actor.id,recorder:actor.name,origin:'reporting',channel:next.channel,revisions:past};
        if(old)Object.assign(old,item);else daily.push(item);
      }return result();
    }
    if(a.type==='propose'){
      check(supervisor,'由PM或创建者整理变更');const r=get(a.feId);check(editable(r),'无权修改此FE');const text=String(a.text||'').trim();check(text,'请写下要处理的变更');
      const edits=parsePlan(r,text,today),scope=edits.some(u=>u.path.startsWith('plan.'))&&r.version?records.filter(x=>x.version===r.version&&x.workflow?.kind!=='research'):[r];
      check(scope.every(x=>!edits.some(u=>u.path.startsWith('plan.')&&x.workflow?.path&&!x.workflow.path.includes(({单车:4,编组:5,灰度:6,上线:8})[u.path.slice(5)]))),'包内有FE不使用该阶段，请先核对适用流程');
      check(scope.every(editable),'包内有其他负责人的FE，请由有整包权限的人员处理');
      const updates=scope.flatMap(x=>edits.map(u=>({...u,feId:x.id,before:read(x,u.path)})));
      reporting.changes.push({id:uid('change'),feId:r.id,text,at,actor:actor.name,recordedBy:actor.id,status:'pending',updates});return result();
    }
    if(a.type==='decide'){
      check(supervisor,'由PM或创建者确认变更');const c=reporting.changes.find(c=>c.id===a.id);check(c&&['pending','held'].includes(c.status),'这条变更已处理，请刷新查看');check(['accepted','rejected','held'].includes(a.result),'请选择处理方式');
      if(a.result==='accepted'){
        check(c.updates.length,'未识别到明确的计划日期，请手动编辑或打开状态与流转');
        for(const u of c.updates){const r=get(u.feId);check(editable(r),'无权修改此FE');check(read(r,u.path)===u.before,'排期已变化，请重新生成变更预览');}
        for(const u of c.updates){const r=get(u.feId);if(u.path==='phase.testing.expectedStart'){r.phaseDates||={};r.phaseDates.testing||={};r.phaseDates.testing.expectedStart=u.value;}else{r.productionPlans||={};r.productionPlans[u.path.slice(5)]=u.value;if(u.path==='plan.上线')r.launchDate=u.value;}
          r.dateLinks||={};r.dateLinks[u.path]={mode:'manual'};r.history||=[];r.history.push({at,actor:actor.name,actorId:actor.id,kind:'change',reason:c.text,text:'确认排期变更',items:[{label:u.label,before:u.before,after:u.value}]});r.updated=at;}
      }
      Object.assign(c,{status:a.result,decidedAt:at,decidedBy:actor.id,decider:actor.name});return result();
    }
    if(a.type==='confirm-report'){
      check(supervisor,'日报由PM或创建者确认');const visible=records.filter(editable);check(visible.length,'没有可确认的FE');
      const visibleIds=new Set(visible.map(r=>r.id));
      const snapshot=facts(visible,daily,today),missing=assignments(visible).filter(x=>!daily.some(d=>d.key===x.feId&&d.date===today&&d.actor===x.person)),changes=copy(reporting.changes.filter(c=>c.status==='accepted'&&c.updates.some(u=>visibleIds.has(u.feId))&&String(c.decidedAt).startsWith(today)));
      const last=reporting.reports.at(-1);if(last?.actorId===actor.id&&JSON.stringify({snapshot,missing,changes})===JSON.stringify({snapshot:last.snapshot,missing:last.missing,changes:last.changes}))return result();
      reporting.reports.push({id:uid('report'),date:today,at,actor:actor.name,actorId:actor.id,status:'awaiting-send',snapshot,missing,changes});return result();
    }
    throw Error('未知进度收集操作');
  }
  window.LubanReporting={initial,normalize,names,active,assignments,personId,facts,apply};
})();
