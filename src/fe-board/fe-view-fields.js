/* FE adapter for the common view layer. No FE or approval facts are changed here. */
window.createFEViewFields=function(opts){
  const states=opts.states||[],fallback=['待开发','开发中','自测中','实验室测试','单车','编组','灰度','上线确认','已上线','中止','方案','待补充'];
  const label=s=>[4,5,6].includes(s)?window.LubanWorkflow?.label(s)||fallback[s]:states[s]?.label||fallback[s]||'待补充';
  const date=(r,path)=>opts.dateValue?.(r,path)||'';
  const pm=r=>opts.pmName?.(r.pm)||r.pm||'';
  const fields=[];
  function add(id,name,value,extra={}){fields.push({id,label:name,section:'基础信息',type:'text',filterable:true,value,...extra});}
  const groupable={groupable:true};
  add('title','FE 名称',r=>r.title);add('code','FE 编号',r=>r.code);
  add('package','包名',r=>r.version||'',{...groupable,emptyLabel:'未关联包',total:(key,c)=>c.packages.get(key)?.total});
  const stageRank=r=>r.stage===10?-1:r.stage;
  add('status','FE 当前阶段',r=>[opts.stateLabel?.(r)||r.sourceStatus||label(r.stage),r.sourceStatus||label(r.stage),label(r.stage),...([4,5,6].includes(r.stage)?[label(r.stage)+'验证']:[])],{...groupable,compare:(a,b)=>stageRank(a)-stageRank(b),group:r=>({key:String(r.stage),label:label(r.stage),rank:stageRank(r)})});
  const phaseOrder=['stage-10','stage-0','stage-1','stage-2','preparing','mixed','stage-3','stage-4','stage-5','stage-6','stage-7','stage-8','stage-9','stage-11','stage-12','stage-13','stage-14'];
  const packageRank=(r,c)=>{const p=c.packages.get(r.version);return !p?99:phaseOrder.indexOf(p.key.startsWith('mixed-')?'mixed':p.key);};
  add('packageStage','包推进阶段',(r,c)=>c.packages.get(r.version)?.label||'未关联包',{...groupable,compare:(a,b,c)=>packageRank(a,c)-packageRank(b,c),group:(r,c)=>{const p=c.packages.get(r.version);return p?{key:p.key,label:p.label,rank:packageRank(r,c)}:{key:'',label:'未关联包',rank:99};}});
  add('module','所属模块（全部参与）',r=>r.modules||[]);add('leadModule','牵头模块',r=>r.leadModule||'',groupable);
  add('partners','协作模块',r=>(r.modules||[]).filter(m=>m!==r.leadModule));
  add('topic','所属专项',r=>r.topic,groupable);add('priority','优先级',r=>r.priority,groupable);
  add('owner','研发负责人',r=>r.owner,groupable);add('pm','所属 PM',pm,groupable);add('testOwner','测试责任人',r=>r.testOwner,groupable);
  add('launchDate','上线日期',r=>r.launchDate,{type:'date'});add('entered','当前阶段进入日期',r=>opts.localDate?.(r.entered)||r.entered||'',{type:'date'});
  add('updated','最近更新日期',r=>opts.localDate?.(r.updated)||r.updated||'',{type:'date'});
  add('createdBy','创建人',r=>opts.pmName?.(r.createdBy)||r.createdBy||'');
  add('period','管理周期',r=>r.period);add('workflow','适用流程',r=>r.workflow?.kind==='research'?'研究任务':'研发发布',groupable);
  add('kind','记录类型',r=>r.kind==='fe'?'FE':'归属待核对');
  add('attention','是否需关注',r=>opts.attention?.(r)?'需关注':'正常',{compare:(a,b)=>opts.attentionCompare?.(a,b)||0});
  for(const [id,name] of [['risk','风险标记'],['expectation','周计划预期'],['okrO','目标（O）'],['okrKR','关键结果（KR）'],['metric','数字指标'],['issues','关联问题'],['notes','跟进备注'],['description','补充说明'],['changes','变更说明']])add(id,name,r=>r[id],{section:'目标与内容'});
  add('documents','相关文档',r=>(r.documents||[]).map(d=>[d.name,d.url]),{section:'目标与内容'});
  add('documentNames','文档名称',r=>(r.documents||[]).map(d=>d.name),{section:'目标与内容'});
  add('documentURLs','文档链接',r=>(r.documents||[]).map(d=>d.url),{section:'目标与内容'});
  add('dailyLatest','最新 FE 进展',(r,c)=>c.latest.get(r.id)?.text||'',{section:'跟进与记录'});
  add('dailyCondition','最新进展情况',(r,c)=>({normal:'正常',risk:'有风险',blocked:'受阻'})[c.latest.get(r.id)?.condition]||'',{section:'跟进与记录'});
  add('dailyHistory','每日进展记录',(r,c)=>c.updates.filter(x=>x.type==='fe'&&x.key===r.id).map(x=>[x.date,x.text,x.actor]),{section:'跟进与记录'});
  add('legacyPackageProgress','原整包进展',(r,c)=>c.updates.filter(x=>x.type==='package'&&x.key===r.version).map(x=>[x.date,x.text,x.actor]),{section:'跟进与记录'});
  add('rollbacks','回退记录',r=>(r.rollbacks||[]).map(x=>[x.at,x.reason,x.stage,x.version]),{section:'跟进与记录'});
  add('history','流转与操作记录',r=>(r.history||[]).map(x=>[x.text,x.actor,x.reason,x.note,x.at,x.items?.map(i=>[i.label,i.before,i.after])]),{section:'跟进与记录'});
  add('changeHistory','变更管理记录',r=>(r.history||[]).filter(x=>x.kind==='change').map(x=>[x.text,x.reason,x.actor,x.items?.map(i=>[i.label,i.before,i.after])]),{section:'跟进与记录'});
  add('gate','门禁情况',r=>[r.gate?.pending?'待确认':'',r.gate?.rejection||'',r.gate?.rd?'研发已确认':'',r.gate?.qa?'质量已确认':''],{section:'跟进与记录'});
  add('gateReason','门禁未通过原因',r=>r.gate?.rejection||'',{section:'跟进与记录'});
  add('source','数据记录',(r,c)=>(r.sourceRefs||[]).map(id=>c.source.get(id)?.values||{}),{section:'跟进与记录'});
  const dateNames={expectedStart:'计划进入',expectedEnd:'历史计划离开',actualStart:'实际进入',actualEnd:'历史实际离开'};
  for(const [id,name] of [['demand','需求'],['development','开发'],['testing','测试'],['production','生产']]){
    for(const [key,title] of Object.entries(dateNames))add('phase.'+id+'.'+key,name+' · '+title,r=>date(r,'phase.'+id+'.'+key),{section:'全部阶段日期',type:'date'});
    if(['development','testing'].includes(id))add('schedule-'+id,name+'（计划与实际进入）',r=>[date(r,'phase.'+id+'.expectedStart'),date(r,'phase.'+id+'.actualStart')],{section:'全部阶段日期'});
  }
  for(const [id,name] of [['single','单车'],['group','编组'],['gray','灰度'],['launch','上线']]){
    for(const [key,title] of Object.entries(dateNames))add('production.'+id+'.'+key,name+' · '+(id==='launch'&&key==='actualEnd'?'实际上线':title),r=>date(r,key==='expectedStart'?'plan.'+name:'production.'+id+'.'+key),{section:'全部阶段日期',type:'date'});
    add('schedule-'+id,name+'（计划与实际进入）',r=>[date(r,'plan.'+name),date(r,'production.'+id+'.'+(id==='launch'?'actualEnd':'actualStart'))],{section:'全部阶段日期'});
  }
  function context(){
    const byPackage=new Map(),packages=new Map(),updates=opts.getDailyUpdates?.()||[],latest=new Map();
    (opts.getRecords?.()||[]).forEach(r=>{if(r.version){if(!byPackage.has(r.version))byPackage.set(r.version,[]);byPackage.get(r.version).push(r);}});
    byPackage.forEach((members,key)=>{const fact=window.LubanGrouping.packageState(members);packages.set(key,{...fact,total:members.length,label:fact.mixed?(fact.ready?[...new Set(members.map(r=>r.stage))].sort((a,b)=>a-b).map(label).join(' / '):'研发准备中'):label(fact.stage)});});
    updates.filter(x=>x.type==='fe').slice().sort((a,b)=>b.date.localeCompare(a.date)||b.at.localeCompare(a.at)).forEach(x=>{if(!latest.has(x.key))latest.set(x.key,x);});
    return {packages,updates,latest,source:new Map((opts.sourceRows||[]).map(r=>[r.id,r]))};
  }
  return {fields,context};
};
