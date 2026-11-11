/* A work item keeps its identity; monthly plans keep independent reviews and estimates. */
(() => {
  const M=window.LubanIntake,R=window.LubanRat,copy=x=>structuredClone(x);
  const taskModules=t=>(t.modules||[t.module]).filter(Boolean);
  const units=t=>Array.isArray(t.allocations)&&t.allocations.length?t.allocations.map(a=>({...t,...a,id:t.id,feId:t.feId,title:t.title,review:t.review,month:t.month,demandId:t.demandId,modules:taskModules(t),module:t.module||taskModules(t)[0]||''})): [t];
  const closed=r=>r&&[8,14].includes(r.stage);
  const text=value=>String(value??'');
  const distinct=values=>[...new Set(values.map(text).filter(value=>value.trim()))];
  const fromText=value=>text(value).split('\n').map(line=>'<p>'+line.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p>').join('');
  const textFromHtml=value=>text(value).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[e])).trim();
  const urls=values=>distinct(values.flatMap(value=>text(value).match(/https?:\/\/[^\s<>"']+/g)||[]).map(value=>value.replace(/[。；，、）\]}>]+$/u,'')));
  function sourceDetails(value,strict=false){
    if(!value||typeof value!=='object'||Array.isArray(value)){if(strict)throw Error('来源明细格式无效');value={};}
    const images=Array.isArray(value.images)?value.images:[];
    if(strict&&Object.hasOwn(value,'images')&&!Array.isArray(value.images))throw Error('来源图片请使用已保存附件引用');
    const refs=images.map(ref=>{
      const valid=ref&&typeof ref==='object'&&!Array.isArray(ref)&&typeof ref.id==='string'&&!!ref.id.trim()&&Object.keys(ref).every(key=>['id','name','mime','size','width','height'].includes(key))&&['size','width','height'].every(key=>!Object.hasOwn(ref,key)||typeof ref[key]==='number'&&Number.isFinite(ref[key])&&ref[key]>=0);
      if(!valid){if(strict)throw Error('来源图片请使用已保存附件引用');return null;}
      return copy(ref);
    }).filter(Boolean);
    const html=Object.hasOwn(value,'html')?text(value.html):(text(value.text)?fromText(text(value.text)):''),plain=Object.hasOwn(value,'text')?text(value.text):textFromHtml(html);
    return {html,text:plain,images:refs,links:Array.isArray(value.links)?distinct(value.links):urls([plain])};
  }
  function fieldsFor(intake,demandId,month){
    const demand=intake.demands.find(d=>d.id===demandId);if(!demand)throw Error('需求已不存在，请刷新');
    const monthly=month!==undefined&&month!==null&&month!=='';
    const tasks=monthly?intake.tasks.filter(t=>t.demandId===demandId&&t.month===month):[];
    const overrides=monthly?demand.monthlyFields?.[month]||{}:demand.structuredFields||{};
    const taskValue=(task,key,column)=>Object.hasOwn(task,key)?task[key]:task.sourceRat?.cells?.[column]||'';
    const values=(key,column)=>Object.hasOwn(overrides,key)?distinct([overrides[key]]):distinct(tasks.map(task=>taskValue(task,key,column)));
    const rich=(name,key,column)=>{
      if(Object.hasOwn(overrides,name+'Html')){const html=text(overrides[name+'Html']);return {html,text:Object.hasOwn(overrides,name+'Text')?text(overrides[name+'Text']):textFromHtml(html)};}
      if(Object.hasOwn(overrides,name+'Text')){const plain=text(overrides[name+'Text']);return {html:plain?fromText(plain):'',text:plain};}
      const plain=distinct(tasks.map(task=>taskValue(task,key,column))).join('\n\n');return {html:plain?fromText(plain):'',text:plain};
    };
    const mokr=rich('mokr','mokr','D'),story=rich('story','story','C');
    const notesText=Object.hasOwn(overrides,'notesText')?text(overrides.notesText):distinct(tasks.map(task=>{if(!task.sourceRat?.cells)return task.notes||'';const c=task.sourceRat.cells,original=[c.R,c.S,c.W].filter(Boolean).join('\n');const manuallyEdited=(task.history||[]).some(h=>h.before&&Object.hasOwn(h.before,'notes')&&h.before.notes!==task.notes);return Object.hasOwn(task,'notes')&&task.notes!==original&&manuallyEdited?task.notes:c.R||'';})).join('\n\n');
    const support=Object.hasOwn(overrides,'sourceDetails')?overrides.sourceDetails:monthly&&Object.hasOwn(demand.structuredFields||{},'sourceDetails')?demand.structuredFields.sourceDetails:{text:distinct(tasks.flatMap(task=>[task.sourceRat?.cells?.S,task.sourceRat?.cells?.W])).join('\n\n'),images:[],links:urls(tasks.flatMap(task=>[task.sourceRat?.cells?.S,task.sourceRat?.cells?.W,task.sourceRat?.cells?.R]))};
    const source=sourceDetails(support);
    const legacyBody=monthly?demand.monthlyDetails?.[month]:{html:demand.detailsHtml||'',text:demand.detailsText||''};
    return {priorityValues:values('priority','E'),topicValues:values('topic','A'),testDateValues:values('testDate','M'),launchDateValues:values('launchDate','N'),mokrText:mokr.text,mokrHtml:mokr.html,storyText:story.text,storyHtml:story.html,notesText,notesHtml:notesText?fromText(notesText):'',sourceDetails:source,bodyHtml:Object.hasOwn(overrides,'bodyHtml')?text(overrides.bodyHtml):text(legacyBody?.html),bodyText:Object.hasOwn(overrides,'bodyText')?text(overrides.bodyText):text(legacyBody?.text)};
  }
  function structuredPatch(value){
    if(value===undefined)return {};
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('独立字段格式无效');
    const allowed=['priority','topic','testDate','launchDate','mokrHtml','mokrText','storyHtml','storyText','notesText','sourceDetails'];
    if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('包含不支持的独立字段');
    const patch={};for(const [key,v] of Object.entries(value))patch[key]=key==='sourceDetails'?sourceDetails(v,true):text(v);
    if(Object.hasOwn(patch,'priority')&&!['','T0','T0.5','T1','T2'].includes(patch.priority))throw Error('优先级请选择T0、T0.5、T1、T2或留空');
    for(const key of ['testDate','launchDate'])if(Object.hasOwn(patch,key)&&patch[key]){const date=patch[key];if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('计划日期无效');}
    for(const name of ['mokr','story'])if(Object.hasOwn(patch,name+'Html')&&!Object.hasOwn(patch,name+'Text'))patch[name+'Text']=textFromHtml(patch[name+'Html']);else if(Object.hasOwn(patch,name+'Text')&&!Object.hasOwn(patch,name+'Html'))patch[name+'Html']=patch[name+'Text']?fromText(patch[name+'Text']):'';
    return patch;
  }
  function entries(intake,month){
    return intake.demands.map(d=>{const tasks=intake.tasks.filter(t=>t.demandId===d.id&&t.month===month);if(!tasks.length)return null;
      const allocations=tasks.flatMap(units),quantities=allocations.map(t=>R.effort(t.effort,R.names(t.owner))),known=quantities.map(p=>p.total);
      const reviewResult=tasks.some(t=>t.review?.result==='passed')?'passed':tasks.some(t=>t.review?.result==='rejected')?'rejected':null;
      return {id:d.id,demand:d,month,tasks,allocations,modules:[...new Set(tasks.flatMap(taskModules).filter(Boolean))],people:[...new Set(allocations.flatMap(t=>R.names(t.owner)))],days:known.reduce((n,x)=>n+(x??0),0),unknown:quantities.some(p=>p.total===null||p.allocations.some(a=>a.days===null)),reviewResult,passed:reviewResult==='passed',allPassed:tasks.every(t=>t.review?.result==='passed'),partial:tasks.some(t=>t.review?.result==='passed')&&!tasks.every(t=>t.review?.result==='passed'),feIds:[...new Set(tasks.map(t=>t.feId).filter(Boolean))]};
    }).filter(Boolean);
  }
  function eligible(intake,records,month){
    const before=[...new Set(intake.tasks.map(t=>t.month).filter(m=>m<month))].sort().reverse(),found=new Set(),carry=[];
    const existing=new Set(entries(intake,month).map(x=>x.id));
    for(const previous of before)for(const item of entries(intake,previous)){
      if(found.has(item.id))continue;found.add(item.id);
      if(existing.has(item.id))continue;
      const linkedIds=intake.tasks.filter(t=>t.demandId===item.id).map(t=>t.feId).filter(Boolean);
      const record=records.find(r=>linkedIds.includes(r.id));if(!record||closed(record))continue;
      carry.push({...item,record});
    }
    return carry;
  }
  const checkMonth=month=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('请选择计划月份');};
  function makeTask(d,month,values,ctx){
    const ms=values.modules||d.modules||[];
    return {id:'RAT-'+ctx.uid(),demandId:d.id,module:ms[0]||'',modules:copy(ms),month,title:M.title(d),topic:'',priority:'',owner:String(values.owner||''),effort:String(values.effort??''),story:'',mokr:'',schemeDate:'',startDate:'',testDate:'',launchDate:'',deliverable:'',notes:'',review:null,feId:values.feId||'',revision:1,history:[],createdAt:ctx.at,createdBy:ctx.actor.id,...(values.allocations?{allocations:copy(values.allocations)}:{})};
  }
  function prepareMonth(input,records,month,ctx){
    checkMonth(month);const intake=M.normalize(input);
    for(const item of eligible(intake,records,month)){
      const previousAllocations=item.tasks.flatMap(units);
      const allocations=previousAllocations.map(a=>({key:a.key||a.id,modules:copy(item.modules),owner:a.owner||'',effort:String(a.effort??'')}));
      const task=makeTask(item.demand,month,{modules:copy(item.modules),owner:[...new Set(allocations.flatMap(a=>R.names(a.owner)))].join('、'),feId:item.record.id,allocations},ctx);
      task.carriedFrom=item.month;
      // Prior estimates stay in their original month. The next month needs fresh estimates.
      task.allocations.forEach(a=>a.effort='');
      intake.tasks.push(task);
    }
    return {intake,records:copy(records)};
  }
  function reconcile(input,inputRecords){
    const intake=M.normalize(input),records=copy(inputRecords);intake.withdrawnFEs||=[];
    for(const r of records){
      const linked=intake.tasks.filter(t=>t.feId===r.id);if(!linked.length)continue;
      const active=linked.filter(t=>t.review?.result==='passed');
      // Reading or editing an old NULL/default decision must not withdraw or stop a FE.
      // Only an explicit review action has those effects.
      if(!active.length){if(r.stage===9&&r.ratDecision?.result==='rejected')r.ratMonths=[...new Set([...(r.ratMonths||[]),r.ratDecision.month])].sort();continue;}
      r.ratMonths=[...new Set([...active.map(t=>t.month),...(r.stage===9&&r.ratDecision?.result==='rejected'?[r.ratDecision.month]:[])])].sort();r.intakeRefs=active.map(t=>({demandId:t.demandId,taskId:t.id}));
      if(r.ratDemandId){
        const d=intake.demands.find(d=>d.id===r.ratDemandId);if(d){r.title=M.title(d);
          const latest=active.map(t=>t.month).sort().at(-1),detail=d.monthlyDetails?.[latest];
          const current=active.filter(t=>t.month===latest);
          r.modules=[...new Set(current.flatMap(t=>units(t).flatMap(taskModules)))];r.leadModule=r.modules.length===1?r.modules[0]:'';
          r.owner=[...new Set(current.flatMap(t=>units(t).flatMap(a=>R.names(a.owner))))].join('、');
          if(detail)r.description=detail.text||'';
        }
      }
    }
    return {intake,records};
  }
  function rejectExecution(intake,records,ids,month,ctx){
    const affected=new Set(ids),removed=new Set();
    // Match workflow-model's cancellation shape, including requests stored on peers.
    for(const record of records)for(const q of record.flowRequests||[])if(q.status==='collecting'&&q.memberIds?.some(id=>affected.has(id))){q.status='cancelled';q.closedAt=ctx.at;q.closedBy=ctx.actor.name;q.closedReason='月度RAT不通过';}
    for(const record of records.filter(r=>affected.has(r.id))){
      record.ratDecision={result:'rejected',month,at:ctx.at,actor:ctx.actor.name};
      if([0,12].includes(record.stage)){
        record.gate={pending:false,rd:false,qa:false,round:1,rejection:''};
        intake.withdrawnFEs=(intake.withdrawnFEs||[]).filter(x=>x.id!==record.id);intake.withdrawnFEs.push({id:record.id,record:copy(record)});removed.add(record.id);continue;
      }
      if(record.stage!==9){
        const snapshot=Object.fromEntries(['stage','entered','sourceStatus','phaseDates','productionDates','researchDates','releaseConfirmedDate'].filter(k=>Object.hasOwn(record,k)).map(k=>[k,copy(record[k])]));
        record.ratStops||=[];record.ratStops.push({...snapshot,at:ctx.at,month,actor:ctx.actor.name});
        record.history||=[];record.history.push({at:ctx.at,actor:ctx.actor.name,actorId:ctx.actor.id,kind:'flow',text:'月度RAT不通过，工作中止',from:record.stage,to:9,reason:'月度RAT不通过'});
        record.stage=9;record.sourceStatus='';record.entered=ctx.today||'';record.updated=ctx.at;
      }
      record.gate={pending:false,rd:false,qa:false,round:1,rejection:''};
    }
    return records.filter(r=>!removed.has(r.id));
  }
  function restoreExecution(record,month,ctx){
    if(record.stage!==9)return;
    const stopped=(record.ratStops||[]).findLast(s=>!s.restoredAt&&s.stage!==9);
    if(!stopped)return; // Do not invent a prior state for an imported stopped item.
    record.stage=stopped.stage;record.entered=stopped.entered||'';record.sourceStatus=stopped.sourceStatus||'';
    for(const key of ['phaseDates','productionDates','researchDates','releaseConfirmedDate'])if(!Object.hasOwn(record,key)&&Object.hasOwn(stopped,key))record[key]=copy(stopped[key]);
    // A resumed item requires new workflow confirmations. Cancelled requests stay closed.
    record.gate={pending:false,rd:false,qa:false,round:1,rejection:''};
    record.history||=[];record.history.push({at:ctx.at,actor:ctx.actor.name,actorId:ctx.actor.id,kind:'flow',text:'月度RAT通过，恢复中止前状态',from:9,to:stopped.stage,reason:'月度RAT通过'});
    stopped.restoredAt=ctx.at;stopped.restoredIn=month;record.updated=ctx.at;
  }
  function setReview(input,inputRecords,a,ctx){
    if(![null,'passed','rejected'].includes(a.result))throw Error('请选择通过、不通过或未选择');
    let intake=M.normalize(input),records=copy(inputRecords);const tasks=intake.tasks.filter(t=>t.demandId===a.demandId&&t.month===a.month);
    if(!tasks.length)throw Error('本月计划已不存在，请刷新');
    for(const task of tasks){if(a.revisions&&a.revisions[task.id]!==task.revision)throw Error('内容已变化，请刷新后再审核');}
    if(a.result===null){
      if(ctx.actor.kind!=='creator')throw Error('审核结果由已授权的记录人维护');
      for(const task of tasks){if(task.review){task.history||=[];task.history.push({at:ctx.at,actor:ctx.actor.name,actorId:ctx.actor.id,text:'审核状态设为空',review:copy(task.review)});}task.review=null;task.reviewExplicit=true;task.updatedAt=ctx.at;task.revision=(task.revision||0)+1;}
      const affected=new Set(tasks.map(t=>t.feId).filter(Boolean));
      for(const record of records)for(const q of record.flowRequests||[])if(q.status==='collecting'&&q.memberIds?.some(id=>affected.has(id))){q.status='cancelled';q.closedAt=ctx.at;q.closedBy=ctx.actor.name;q.closedReason='月度RAT审核状态设为空';}
      for(const record of records.filter(r=>affected.has(r.id))){record.ratDecision={result:null,month:a.month,at:ctx.at,actor:ctx.actor.name};record.gate={pending:false,rd:false,qa:false,round:1,rejection:''};intake.withdrawnFEs=(intake.withdrawnFEs||[]).filter(x=>x.id!==record.id);intake.withdrawnFEs.push({id:record.id,record:copy(record)});}
      return {intake,records:records.filter(r=>!affected.has(r.id))};
    }
    for(const task of tasks){const result=M.apply(intake,records,{type:'review',id:task.id,revision:task.revision,result:a.result,evidence:''},ctx);intake=result.intake;records=result.records;intake.tasks.find(t=>t.id===task.id).review.explicit=true;}
    if(a.result==='passed'){
      for(const id of new Set(tasks.map(t=>t.feId).filter(Boolean)))if(!records.some(r=>r.id===id)){
        const withdrawn=intake.withdrawnFEs?.find(x=>x.id===id);if(withdrawn)records.push(copy(withdrawn.record));
        else throw Error('关联FE暂不可恢复，请先核对原任务');
      }
      const ids=tasks.map(t=>t.id);const result=R.admit(intake,records,ids,ctx);intake=result.intake;records=result.records;
      const linked=new Set(intake.tasks.filter(t=>ids.includes(t.id)).map(t=>t.feId));
      for(const record of records.filter(r=>linked.has(r.id))){restoreExecution(record,a.month,ctx);record.ratDecision={result:'passed',month:a.month,at:ctx.at,actor:ctx.actor.name};}
      const restored=new Set(records.map(r=>r.id));intake.withdrawnFEs=(intake.withdrawnFEs||[]).filter(x=>!restored.has(x.id));
    }else records=rejectExecution(intake,records,tasks.map(t=>t.feId).filter(Boolean),a.month,ctx);
    return reconcile(intake,records);
  }
  function toggle(input,records,a,ctx){return setReview(input,records,{...a,result:a.checked?'passed':'rejected'},ctx);}
  function save(input,inputRecords,a,ctx){
    const months=a.month; if(months)checkMonth(months);
    const patch=structuredPatch(a.structuredPatch);
    const tags=Object.fromEntries(M.tagFields.filter(key=>Object.hasOwn(a,key)).map(key=>[key,a[key]]));
    let result=M.apply(input,inputRecords,{type:'demand-save',id:a.demandId||undefined,revision:a.revision,content:a.content,modules:a.modules||[],source:a.source||'',materials:a.materials||'',...tags},ctx);
    let {intake,records}=result;const d=a.demandId?intake.demands.find(d=>d.id===a.demandId):intake.demands.at(-1);
    for(const t of intake.tasks.filter(t=>t.demandId===d.id))t.title=M.title(d);
    const previousDemand=input.demands?.find(x=>x.id===d.id);
    if(previousDemand&&previousDemand.content!==d.content){
      const linked=new Set(intake.tasks.filter(t=>t.demandId===d.id).map(t=>t.feId));
      for(const r of records)if(linked.has(r.id))r.title=M.title(d);
      for(const saved of intake.withdrawnFEs||[])if(linked.has(saved.id))saved.record.title=M.title(d);
    }
    if(months){
      let tasks=intake.tasks.filter(t=>t.demandId===d.id&&t.month===months);
      if(!tasks.length){const previous=intake.tasks.filter(t=>t.demandId===d.id&&t.feId).at(-1);const task=makeTask(d,months,{...a,feId:previous?.feId||''},ctx);intake.tasks.push(task);tasks=[task];}
      if(a.taskRevisions)for(const task of tasks)if(a.taskRevisions[task.id]!==undefined&&a.taskRevisions[task.id]!==task.revision)throw Error('内容已变化，请重新打开后保存');
      for(const task of tasks){
        task.modules=copy(a.modules||[]);task.module=task.modules[0]||'';
        const allocation=a.assignments?.find(x=>x.id===task.id);
        if(allocation){
          if(task.allocations){task.allocations=copy(allocation.allocations||task.allocations);task.owner=[...new Set(task.allocations.flatMap(a=>R.names(a.owner)))].join('、');}else{task.owner=String(allocation.owner??task.owner);task.effort=String(allocation.effort??task.effort);}
        }else if(tasks.length===1&&!task.allocations){task.owner=String(a.owner??task.owner);task.effort=String(a.effort??task.effort);}
        if(task.allocations)task.allocations.forEach(allocation=>allocation.modules=copy(task.modules));
        for(const key of ['priority','topic','testDate','launchDate'])if(Object.hasOwn(patch,key))task[key]=patch[key];
        for(const [key,field] of [['mokrText','mokr'],['storyText','story'],['notesText','notes']])if(Object.hasOwn(patch,key))task[field]=patch[key];
        task.revision=(task.revision||0)+1;
      }
      if(Object.keys(patch).length){d.monthlyFields||={};d.monthlyFields[months]={...(d.monthlyFields[months]||{}),...copy(patch)};}
      if(Object.hasOwn(a,'detailsHtml')){d.monthlyDetails||={};d.monthlyDetails[months]={html:String(a.detailsHtml||''),text:String(a.detailsText||'')};}
    }else{
      if(Object.keys(patch).length)d.structuredFields={...(d.structuredFields||{}),...copy(patch)};
      if(Object.hasOwn(a,'detailsHtml')){d.detailsHtml=String(a.detailsHtml||'');d.detailsText=String(a.detailsText||'');}
    }
    const updated=reconcile(intake,records);return {...updated,demandId:d.id};
  }
  window.LubanRatWorkspace={entries,eligible,prepareMonth,reconcile,setReview,toggle,save,units,taskModules,fieldsFor};
})();
