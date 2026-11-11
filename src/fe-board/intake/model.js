/* Demand intake and monthly tasks; FE execution remains owned by the existing flow. */
(() => {
  const copy=x=>structuredClone(x);
  const tagFields=['classificationTags','triggerScenes'];
  const initialTags={classificationTags:[],triggerScenes:[]};
  const tagValues=values=>[...new Set((Array.isArray(values)?values:[]).filter(v=>typeof v==='string').map(v=>v.trim()).filter(Boolean))];
  const tagChoices=(state,key)=>tagValues([...(initialTags[key]||[]),...tagValues(state.tagOptions?.[key]),...(state.demands||[]).flatMap(d=>tagValues(d[key]))]);
  const initial=()=>({version:1,demands:[],tasks:[],tagOptions:copy(initialTags)});
  const categories=['问题注入','外部需求','内部迭代'];
  const demandCategories=d=>[...new Set((Array.isArray(d.categories)?d.categories:[d.category]).filter(c=>categories.includes(c)))];
  const demandSource=d=>categories.includes(d?.source)?d.source:categories.includes(d?.category)?d.category:demandCategories(d||{}).length===1?demandCategories(d)[0]:'';
  const normalize=s=>{
    const state={...copy(s||{}),version:1,demands:copy(s?.demands||[]).map(d=>({...d,source:demandSource(d),categories:demandCategories(d),...Object.fromEntries(tagFields.map(key=>[key,tagValues(d[key])]))})),tasks:copy(s?.tasks||[])};
    state.tagOptions=Object.fromEntries(tagFields.map(key=>[key,tagChoices(state,key)]));return state;
  };
  const title=d=>String(d?.content||'').split('\n').find(x=>x.trim())?.replace(/^#+\s*/,'').trim().slice(0,500)||'未命名需求';
  const filterDemands=(state,f={})=>state.demands.filter(d=>(!f.module||d.modules.includes(f.module))&&(!f.source||demandSource(d)===f.source)&&(!(f.categories?.length||f.category)||demandCategories(d).some(c=>(f.categories||[f.category]).includes(c)))&&tagFields.every(key=>!f[key]?.length||tagValues(d[key]).some(value=>f[key].includes(value)))&&(!f.search||[d.content,d.materials,...demandCategories(d),...d.modules,...tagFields.flatMap(key=>tagValues(d[key]))].join(' ').toLowerCase().includes(f.search.toLowerCase())));
  const taskFields=['title','module','month','topic','priority','owner','effort','story','mokr','schemeDate','startDate','testDate','launchDate','deliverable','notes'];
  function apply(input,inputRecords,a,ctx){
    const intake=normalize(input),records=copy(inputRecords),actor=ctx.actor,at=ctx.at,createdIds=[];
    const uid=prefix=>prefix+'-'+ctx.uid(),text=(x,max=30000)=>String(x??'').trim().slice(0,max);
    const demand=id=>{const d=intake.demands.find(x=>x.id===id);if(!d)throw Error('需求已不存在，请刷新');return d;};
    const task=id=>{const t=intake.tasks.find(x=>x.id===id);if(!t)throw Error('月度任务已不存在，请刷新');return t;};
    const admin=actor.kind==='creator',editDemand=d=>admin||d.createdBy===actor.id||actor.kind==='pm'&&d.modules.includes(actor.module),editTask=t=>admin||actor.kind==='pm'&&t.module===actor.module;
    const check=(ok,msg='由创建者或对应模块维护人操作')=>{if(!ok)throw Error(msg);};
    const revision=x=>{if(a.revision!==undefined&&a.revision!==x.revision)throw Error('内容已变化，请重新打开后操作');};
    const log=(x,message,extra={})=>{x.history||=[];x.history.push({at,actorId:actor.id,actor:actor.name,text:message,...extra});x.updatedAt=at;x.revision=(x.revision||0)+1;};
    const modules=values=>{const xs=[...new Set((values||[]).map(x=>text(x,100)).filter(Boolean))];if(xs.some(x=>!ctx.modules.includes(x)))throw Error('请选择已有模块');return xs;};
    const validMonth=m=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))throw Error('请选择计划月份');};
    const validDate=d=>{if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))throw Error('计划日期无效');};
    const result=()=>({intake,records,createdIds});
    if(a.type==='demand-save'){
      const content=text(a.content);check(!!content,'请填写需求内容');let d;
      if(a.id){d=demand(a.id);check(editDemand(d));revision(d);}else{d={id:uid('REQ'),createdAt:at,createdBy:actor.id,history:[],revision:0};intake.demands.push(d);createdIds.push(d.id);}
      const selected=Object.hasOwn(a,'source')?(a.source?[a.source]:[]):a.categories??(a.category?[a.category]:[]);check(Array.isArray(selected)&&selected.length<=1&&selected.every(c=>categories.includes(c)),'需求来源请选择问题注入、外部需求或内部迭代中的一项');
      const before=Object.fromEntries(['content','modules','source','materials',...tagFields].map(k=>[k,copy(d[k])]));
      Object.assign(d,{content,modules:modules(a.modules),source:selected[0]||'',categories:selected,category:'',materials:text(a.materials)});
      for(const key of tagFields){if(Object.hasOwn(a,key))check(Array.isArray(a[key]),'请选择多选标签');d[key]=tagValues(Object.hasOwn(a,key)?a[key]:d[key]);intake.tagOptions[key]=tagValues([...intake.tagOptions[key],...d[key]]);}
      log(d,a.id?'更新需求':'录入需求',a.id?{before}:{});return result();
    }
    if(a.type==='plan'){
      const d=demand(a.demandId),month=text(a.month,7),selected=modules(a.modules??d.modules);validMonth(month);
      check(admin||actor.kind==='pm'&&selected.every(m=>m===actor.module),'由有权限的维护人加入月度计划');
      if(intake.tasks.some(t=>t.demandId===d.id&&t.month===month))return result();
      const t={id:uid('RAT'),demandId:d.id,module:selected[0]||'',modules:selected,month,title:title(d),topic:'',priority:'',owner:'',effort:'',story:'',mokr:'',schemeDate:'',startDate:'',testDate:'',launchDate:'',deliverable:'',notes:'',review:null,feId:'',history:[],revision:0,createdAt:at,createdBy:actor.id};log(t,'加入月度计划');intake.tasks.push(t);createdIds.push(t.id);
      if(selected.some(m=>!d.modules.includes(m))){d.modules=[...new Set([...d.modules,...selected])];log(d,'关联任务模块');}return result();
    }
    if(a.type==='task-save'){
      const t=task(a.id);check(editTask(t));revision(t);const before=Object.fromEntries(taskFields.map(k=>[k,copy(t[k])])),fields={};
      for(const key of taskFields)fields[key]=Object.hasOwn(a,key)?text(a[key],key==='title'?120:30000):t[key];
      modules(fields.module?[fields.module]:[]);validMonth(fields.month);for(const key of ['schemeDate','startDate','testDate','launchDate'])validDate(fields[key]);
      if(taskFields.every(k=>fields[k]===t[k]))return result();
      if(t.review){t.history.push({at,actorId:actor.id,actor:actor.name,text:'保留此前审核结果',review:copy(t.review)});}
      Object.assign(t,fields);log(t,'更新月度任务',{before});return result();
    }
    if(a.type==='review'){
      const t=task(a.id);check(admin,'审核结果由已授权的记录人维护');revision(t);check(['passed','rejected'].includes(a.result),'请选择通过或不通过');
      const evidence=text(a.evidence,4000);if(t.review?.result===a.result&&t.review.evidence===evidence)return result();
      if(t.review)t.history.push({at,actorId:actor.id,actor:actor.name,text:'此前审核结果',review:copy(t.review)});
      const snapshot=Object.fromEntries(['demandId',...taskFields].map(k=>[k,copy(t[k])]));
      t.review={result:a.result,evidence,at,actorId:actor.id,actor:actor.name,snapshot};log(t,a.result==='passed'?'记录RAT通过':'记录RAT不通过');return result();
    }
    if(a.type==='transfer'){
      check(Array.isArray(a.groups)&&a.groups.length,'请选择已通过的月度任务');const seen=new Set();
      for(const group of a.groups){
        const ts=[...new Set(group.taskIds||[])].map(task);check(ts.length,'请选择月度任务');check(ts.every(editTask));
        check(ts.every(t=>t.review?.result==='passed'),'只有RAT通过的任务可以转入FE');
        check(ts.every(t=>!seen.has(t.id)),'同一任务不能在一次转入中重复');ts.forEach(t=>seen.add(t.id));
        if(ts.every(t=>t.feId)){check(!group.feId||ts.every(t=>t.feId===group.feId),'任务已关联其他FE，请查看现有关系');continue;}
        let fe;
        if(group.feId){fe=records.find(r=>r.id===group.feId);check(!!fe,'目标FE已不存在');check(ts.every(t=>!t.feId||t.feId===fe.id),'所选任务已关联其他FE');}
        else{
          check(ts.every(t=>!t.feId),'所选任务已有FE，请选择关联该FE');check(new Set(ts.map(t=>t.demandId)).size===1,'不同需求请分别确认FE归属');
          const fields=group.fields||{};check(!!text(fields.title),'请填写FE名称');for(const key of ['startDate','testDate','launchDate','researchEnd'])validDate(fields[key]||'');
          const used=[...records.map(r=>r.id),...(ctx.reservedFEIds||[]),...intake.tasks.map(t=>t.feId)],number=Math.max(150,...used.map(id=>/^FE-\d+$/.test(id)?Number(id.slice(3)):0))+1,id='FE-'+number;
          fe=ctx.newFE({id,fields:copy(fields),tasks:copy(ts),demands:ts.map(t=>copy(demand(t.demandId)))});check(fe?.id===id,'FE创建结果无效');records.push(fe);createdIds.push(id);
        }
        fe.intakeRefs||=[];
        for(const t of ts){if(t.feId)continue;t.feId=fe.id;t.transferSnapshot=copy(t.review);if(!fe.intakeRefs.some(ref=>ref.taskId===t.id))fe.intakeRefs.push({demandId:t.demandId,taskId:t.id});log(t,'关联FE '+fe.id);}
      }return result();
    }
    throw Error('未知需求池操作');
  }
  window.LubanIntake={initial,normalize,title,filterDemands,apply,taskFields,categories,demandCategories,demandSource,tagFields,tagValues,tagChoices};
})();
