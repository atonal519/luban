/* November RAT source, personal allocations and a fixed 21-day monthly capacity.
   Existing FE execution is referenced, never copied into the monthly plan. */
(() => {
  const MONTHLY_CAPACITY = 21;
  const clone = value => structuredClone(value);
  const names = value => [...new Set(String(value || '').split(/[,，、;；\n]+/).map(x => x.trim()).filter(Boolean))];
  const sourceId = source => 'rat-' + source.month + '-20261105';
  const policyId = source => sourceId(source) + '-explicit-rejections-only-v1';
  const needsImport = (intake,source) => source && (!intake.ratImports?.includes(sourceId(source)) || !intake.ratReviewPolicies?.includes(policyId(source)) || source.revision&&intake.ratSourceRevisions?.[source.month]!==source.revision);
  const aliases = {'车控':'控制','AI Lab':'AiLab','AI LAB':'AiLab','AI实验室':'AiLab'};
  const modules = value => [...new Set(names(value).map(x => aliases[x] || x))];
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const scalar=value=>String(value??'').trim();
  const sourceNotes=c=>[c.R,c.S,c.W].filter(Boolean).join('\n');
  const sourceHomes=(source,cells)=>Object.fromEntries(names(cells.H).filter(person=>source.resourceHomeModules?.[person]).map(person=>[person,source.resourceHomeModules[person]]));

  function refreshSource(intake,source,ctx){
    const byRow=new Map(source.rows.map(row=>[row.row,row.cells]));
    const imported=intake.tasks.filter(t=>t.sourceRat?.id===sourceId(source));
    const protectedKeys={priority:['priority'],topic:['topic'],testDate:['testDate'],launchDate:['launchDate'],mokr:['mokrText','mokrHtml'],story:['storyText','storyHtml'],notes:['notesText']};
    const columns={title:'B',topic:'A',priority:'E',story:'C',mokr:'D',schemeDate:'K',startDate:'L',testDate:'M',launchDate:'N',deliverable:'O'};
    // The original source row owns identity; current values win over a later source edit.
    for(const demand of intake.demands){
      const tasks=imported.filter(t=>t.demandId===demand.id&&byRow.has(t.sourceRat.row));if(!tasks.length)continue;
      const oldTitles=[...new Set(tasks.map(t=>scalar(t.sourceRat.cells.B)))],newTitles=[...new Set(tasks.map(t=>scalar(byRow.get(t.sourceRat.row)?.B)).filter(Boolean))];
      const oldModules=[...new Set(tasks.flatMap(t=>modules(t.sourceRat.cells.G)))],newModules=[...new Set(tasks.flatMap(t=>modules(byRow.get(t.sourceRat.row)?.G)))];
      let changed=false;
      if(oldTitles.length===1&&newTitles.length===1&&scalar(demand.content)===oldTitles[0]&&oldTitles[0]!==newTitles[0]){demand.content=newTitles[0];changed=true;}
      if(same(demand.modules,oldModules)&&!same(oldModules,newModules)){demand.modules=newModules;changed=true;}
      if(changed){demand.revision=(demand.revision||0)+1;demand.updatedAt=ctx.at;}
    }
    for(const task of imported){
      const fresh=byRow.get(task.sourceRat.row);if(!fresh)continue;
      const previous=task.sourceRat.cells,demand=intake.demands.find(d=>d.id===task.demandId),overrides=demand?.monthlyFields?.[task.month]||{},before={};
      const assign=(key,oldValue,newValue)=>{
        if(protectedKeys[key]?.some(k=>Object.hasOwn(overrides,k)))return;
        if(scalar(task[key])===scalar(oldValue)&&scalar(task[key])!==scalar(newValue)){before[key]=clone(task[key]);task[key]=newValue??'';}
      };
      for(const [key,column] of Object.entries(columns))assign(key,previous[column],fresh[column]);
      assign('notes',sourceNotes(previous),sourceNotes(fresh));
      // Owner and effort form one allocation. Never repartition a hand-edited estimate.
      if(!task.allocations&&same(names(task.owner),names(previous.H))&&scalar(task.effort)===scalar(previous.J)){
        assign('owner',previous.H,fresh.H);assign('effort',previous.J,fresh.J);
      }
      if(same(task.modules||[task.module],modules(previous.G))&&!same(modules(previous.G),modules(fresh.G))){before.modules=clone(task.modules||[task.module]);task.modules=modules(fresh.G);task.module=task.modules[0]||'';}
      const changedSource=!same(previous,fresh),homes=sourceHomes(source,fresh);
      task.sourceRat={...task.sourceRat,cells:clone(fresh),revision:source.revision,...(Object.keys(homes).length?{resourceHomeModules:homes}:{})};
      if(changedSource||Object.keys(before).length){
        task.revision=(task.revision||0)+1;task.updatedAt=ctx.at;
        if(Object.keys(before).length){task.history||=[];task.history.push({at:ctx.at,actorId:ctx.actor.id,actor:ctx.actor.name,text:'同步RAT来源字段',before});}
      }
    }
    intake.ratSourceRevisions={...(intake.ratSourceRevisions||{}),[source.month]:source.revision};
  }

  function effort(raw, people) {
    const text = String(raw ?? '').trim(), allocations = people.map(person => ({person, days:null}));
    const positional=text.includes('/');
    const valid=positional?/^(?:\d+(?:\.\d+)?)?(?:\s*\/\s*(?:\d+(?:\.\d+)?)?)+$/:/^\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)*$/;
    if (!valid.test(text)) return {total:null, allocations};
    // Slash blanks keep their person slot. Only filled values contribute to known effort.
    const parts = text.split(positional?'/':'+').map(part=>part.trim()===''?null:Number(part)), known=parts.filter(part=>part!==null);
    const total=known.length?known.reduce((a,b)=>a+b,0):null;
    if(total===null)return {total:null,allocations};
    if (!Number.isFinite(total)) return {total:null, allocations};
    if (people.length === 1) allocations[0].days = total;
    else if (parts.length > 1 && parts.length === people.length) allocations.forEach((a,i) => a.days = parts[i]);
    else if (people.length > 1 && parts.length === 1) allocations.forEach(a => a.days = total/people.length);
    return {total, allocations};
  }

  function admit(input, inputRecords, ids, ctx) {
    let intake = clone(input), records = clone(inputRecords);
    const selected = intake.tasks.filter(t => ids.includes(t.id) && t.review?.result === 'passed' && !t.feId);
    for (const demandId of new Set(selected.map(t => t.demandId))) {
      const tasks = selected.filter(t => t.demandId === demandId), demand = intake.demands.find(d => d.id === demandId);
      const linked = [...new Set(intake.tasks.filter(t => t.demandId === demandId && records.some(r => r.id === t.feId)).map(t => t.feId))];
      if (linked.length > 1) throw Error('该需求已有多个 FE，请在转入预览中明确归属');
      const candidates = tasks.some(t=>t.sourceRat)?records.filter(r => r.title.trim() === demand.content.trim()):[];
      const feId = linked[0] || (candidates.length === 1 ? candidates[0].id : '');
      const consistent = key => { const values = [...new Set(tasks.map(t => t[key]).filter(Boolean))];return values.length === 1 ? values[0] : ''; };
      const fields = {title:demand.content.split('\n')[0],flowKind:'release',startDate:consistent('startDate'),testDate:consistent('testDate'),launchDate:consistent('launchDate')};
      const before = new Set(records.map(r => r.id));
      const result = window.LubanIntake.apply(intake, records, {type:'transfer',groups:[{taskIds:tasks.map(t=>t.id),...(feId ? {feId} : {fields})}]}, ctx);
      intake = result.intake;records = result.records;
      // Source status is evidence only for newly created imported FEs. No actual date is inferred.
      for (const record of records.filter(r => !before.has(r.id))) {
        record.ratDemandId=demandId;
        const imported = tasks.filter(t => t.sourceRat);
        if (imported.length) {
          const stages = imported.map(t => ({'开发':1,'提测':2,'实验室':3,'灰度':6,'全车':8,'中止':9}[t.sourceRat.cells.U] ?? 0));
          record.stage = Math.min(...stages);record.entered = '';
          record.ratSourceStatus = imported.map(t => ({taskId:t.id,status:t.sourceRat.cells.U || ''}));
        }
      }
      // Auto-created FEs can receive further module tasks when each row is approved.
      // Existing manually maintained FE metadata remains intact.
      const created=records.find(r=>r.ratDemandId===demandId);
      if(created)created.modules=[...new Set([...(created.modules||[]),...intake.tasks.filter(t=>t.feId===created.id).flatMap(t=>t.modules||[t.module])].filter(Boolean))];
    }
    return {intake,records};
  }

  function importSource(input, inputRecords, source, ctx) {
    const intake = window.LubanIntake.normalize(input), records = clone(inputRecords);
    intake.ratImports ||= [];
    if (!needsImport(intake,source)) return {intake,records};
    if(intake.ratImports.includes(sourceId(source))&&source.revision&&intake.ratSourceRevisions?.[source.month]!==source.revision){
      refreshSource(intake,source,ctx);
      // A source correction is not a new review or FE transition.
      if(intake.ratReviewPolicies?.includes(policyId(source)))return {intake,records};
    }
    if(!intake.ratImports.includes(sourceId(source))){
    const byTitle = new Map();
    for (const row of source.rows) {
      const c = row.cells, title = String(c.B || '').trim();if (!title) continue;
      let demand = byTitle.get(title);
      if (!demand) {
        const id = 'REQ-RAT-' + source.month.replace('-','') + '-' + row.row;
        demand = intake.demands.find(d => d.id === id) || {id,content:title,modules:[],category:'',materials:'',createdAt:ctx.at,createdBy:'rat-source',revision:1,history:[{at:ctx.at,actorId:ctx.actor.id,actor:ctx.actor.name,text:'载入 '+source.sheet+' 原始工作'}]};
        if (!intake.demands.includes(demand)) intake.demands.push(demand);
        byTitle.set(title,demand);
      }
      const taskModules = modules(c.G);demand.modules = [...new Set([...demand.modules,...taskModules])];
      const id = 'STORY-RAT-' + source.month.replace('-','') + '-' + row.row;
      if (intake.tasks.some(t => t.id === id)) continue;
      const task = {id,demandId:demand.id,module:taskModules[0] || '',modules:taskModules,month:source.month,title,topic:c.A||'',priority:c.E||'',owner:c.H||'',effort:c.J??'',story:c.C||'',mokr:c.D||'',schemeDate:c.K||'',startDate:c.L||'',testDate:c.M||'',launchDate:c.N||'',deliverable:c.O||'',notes:sourceNotes(c),review:null,feId:'',revision:1,createdAt:ctx.at,createdBy:'rat-source',history:[{at:ctx.at,actor:ctx.actor.name,actorId:ctx.actor.id,text:'载入源表第 '+row.row+' 行'}],sourceRat:{id:sourceId(source),file:source.sourceName,sheet:source.sheet,row:row.row,cells:clone(c),resourceHomeModules:sourceHomes(source,c)}};
      const review = String(c.I||'').trim()==='不通过'?'rejected':'passed';
      if (review) task.review = {result:review,evidence:['通过','不通过'].includes(c.I)?'原表审核结果':'11月RAT：仅明确不通过的条目不予通过',at:'',actorId:'rat-source',actor:'原表记录',snapshot:Object.fromEntries(['demandId',...window.LubanIntake.taskFields].map(k=>[k,clone(task[k])]))};
      intake.tasks.push(task);
    }
    intake.ratImports.push(sourceId(source));
    }
    // Apply the user's clarified November review rule once, including saved v41 imports.
    // A later manual decision or edited task is never reset on reload.
    for(const task of intake.tasks.filter(t=>t.sourceRat?.id===sourceId(source)&&t.review?.result!=='rejected'&&t.review?.result!=='passed')){
      if(task.review)task.history.push({at:ctx.at,actor:ctx.actor.name,actorId:ctx.actor.id,text:'调整11月审核口径',review:clone(task.review)});
      task.review={result:'passed',evidence:'11月RAT：仅明确不通过的条目不予通过',at:ctx.at,actorId:ctx.actor.id,actor:ctx.actor.name,snapshot:Object.fromEntries(['demandId',...window.LubanIntake.taskFields].map(k=>[k,clone(task[k])]))};
      task.revision=(task.revision||0)+1;
    }
    intake.ratReviewPolicies=[...new Set([...(intake.ratReviewPolicies||[]),policyId(source)])];
    if(source.revision)intake.ratSourceRevisions={...(intake.ratSourceRevisions||{}),[source.month]:source.revision};
    return admit(intake,records,intake.tasks.filter(t=>t.sourceRat?.id===sourceId(source)&&t.review?.result==='passed').map(t=>t.id),ctx);
  }

  function approve(input, records, action, ctx) {
    const result = window.LubanIntake.apply(input, records, {...action,type:'review',result:'passed'},ctx);
    return admit(result.intake,result.records,[action.id],ctx);
  }

  function resources(intake, month, scope='passed') {
    const originalModules=new Map();
    for(const t of intake.tasks){
      const cells=t.sourceRat?.cells;if(!cells)continue;
      const homes=t.sourceRat.resourceHomeModules;
      if(homes&&Object.keys(homes).length){for(const [person,module] of Object.entries(homes)){if(!originalModules.has(person))originalModules.set(person,new Set());originalModules.get(person).add(module);}continue;}
      for(const person of names(cells.H)){
        if(!originalModules.has(person))originalModules.set(person,new Set());
        for(const module of modules(cells.G))originalModules.get(person).add(module);
      }
    }
    const plans=intake.tasks.filter(t=>t.month===month),all=plans.flatMap(t=>window.LubanRatWorkspace?window.LubanRatWorkspace.units(t):[t]), selected = all.filter(t=>scope==='all'||t.review?.result==='passed'), people = new Map();
    for (const t of all) for (const name of names(t.owner)) {
      if (!people.has(name)) people.set(name,{name,modules:[],tasks:[],days:0,unknown:0,capacity:null,remaining:null,overloaded:false});
      const p = people.get(name);p.modules = [...new Set([...p.modules,...(t.modules||[t.module]).filter(Boolean)])];
      if (!selected.includes(t)) continue;
      const parsed = effort(t.effort,names(t.owner)), allocation = parsed.allocations.find(a=>a.person===name);
      p.tasks.push(t);if (allocation?.days === null || allocation?.days === undefined) p.unknown++;else p.days+=allocation.days;
    }
    for (const p of people.values()) {
      // Original RAT ownership stays stable when a person contributes to another module.
      const original=originalModules.get(p.name);
      p.homeModule=original?(original.size===1?[...original][0]:''):p.modules.length===1?p.modules[0]:'';
      // Old personal overrides remain in saved archives but no longer set the shared limit.
      p.capacity = MONTHLY_CAPACITY;
      // Floating-point sums at the limit must not produce "spare/over 0 days".
      const tolerance=Number.EPSILON*Math.max(1,p.days,p.capacity)*Math.max(1,p.tasks.length);
      if(Math.abs(p.capacity-p.days)<=tolerance)p.days=p.capacity;
      p.remaining = p.unknown ? null : p.capacity-p.days;p.overloaded=p.days>p.capacity;
    }
    const parsed = selected.map(t=>effort(t.effort,names(t.owner)));
    return {people:[...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')),taskCount:new Set(selected.map(t=>t.demandId||t.id)).size,totalDays:parsed.reduce((n,p)=>n+(p.total??0),0),knownRows:parsed.filter(p=>p.total!==null).length,unknownRows:parsed.filter(p=>p.total===null).length,unallocatedRows:selected.filter((t,i)=>!names(t.owner).length||parsed[i].allocations.some(a=>a.days===null)).length};
  }
  window.LubanRat = {sourceId,policyId,needsImport,names,effort,importSource,approve,admit,monthlyCapacity:MONTHLY_CAPACITY,resources};
})();
