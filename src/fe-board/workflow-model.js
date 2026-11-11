/* Flow facts and requests are distinct. No browser storage or notification side effects. */
(() => {
  const releasePath=[10,1,2,3,4,5,6,8], researchPath=[12,13,14];
  const labels={0:'待开发',1:'开发中',2:'自测中',3:'实验室测试',8:'上线确认完成',9:'中止',10:'方案',11:'待补充',12:'未开始',13:'研究中',14:'已结束'};
  const roles={rd:'研发确认',qa:'质量确认',domain:'领域负责人确认',field:'现场同意（PM记录）'};
  const production={4:'单车',5:'编组',6:'灰度'};
  const copy=x=>structuredClone(x), label=s=>production[s]||labels[s]||'待补充';
  const describe=f=>(f.kind==='research'?'研究任务':'研发发布')+'：'+(f.path||releasePath).map(label).join(' → ')+(Object.entries(f.planGaps||{}).length?'；排期间隔 '+Object.entries(f.planGaps).map(([key,value])=>key.split('>').map(Number).map(label).join(' → ')+' '+value+' 个工作日').join('；'):'');
  function definition(r){const kind=r.workflow?.kind==='research'?'research':'release';return {kind,path:kind==='research'?researchPath.slice():(r.workflow?.path||releasePath).slice()};}
  const terminal=r=>r.stage===9||r.stage===8||r.stage===14;
  function next(r){if(terminal(r))return null;const p=definition(r).path,i=p.indexOf(r.stage);return i>=0?p[i+1]??null:p.find(s=>s!==10)??null;}
  function scope(records,id,target){const r=records.find(x=>x.id===id);if(!r)throw Error('该事项已不存在');return r.version&&definition(r).kind==='release'&&(target>=4&&target<=8||r.stage>=4&&r.stage<=8)?records.filter(x=>x.version===r.version&&definition(x).kind==='release').map(x=>x.id):[id];}
  function nextTarget(records,id){const r=records.find(x=>x.id===id);if(!r)return null;if(r.version&&r.stage>=3&&r.stage<8&&definition(r).kind==='release'){const peers=records.filter(x=>x.version===r.version&&x.stage>=3&&x.stage<8&&definition(x).kind==='release');const driver=peers.slice().sort((a,b)=>a.stage-b.stage)[0];return next(driver||r);}return next(r);}
  const requests=records=>records.flatMap(r=>r.flowRequests||[]);
  const active=(records,id)=>requests(records).find(q=>q.status==='collecting'&&q.memberIds.includes(id))||null;
  const members=(records,q)=>q.memberIds.map(id=>records.find(r=>r.id===id)).filter(Boolean);
  const base=(records,q)=>JSON.stringify((q.version?records.filter(r=>r.version===q.version&&definition(r).kind==='release'):members(records,q)).map(r=>[r.id,r.stage,r.version||'',definition(r)]).sort((a,b)=>a[0].localeCompare(b[0])));
  function taskContext(records,q,role){
    const rs=members(records,q);
    if(role==='rd')return JSON.stringify(rs.map(r=>[r.id,r.owner,r.title,r.description||'',r.documents||[]]));
    if(role==='qa')return JSON.stringify(rs.map(r=>[r.id,r.documents||[],r.issues||[],r.metric||'']));
    if(role==='domain')return JSON.stringify(rs.map(r=>[r.id,r.title,r.description||'']));
    return JSON.stringify(q.tasks.filter(t=>t.role!=='field').map(t=>[t.role,t.status,t.context,t.confirmedBy?.at,t.note,t.url]));
  }
  function readiness(records,q){
    if(!q)return {ready:false,missing:['尚未发起申请']};
    if(q.base&&q.base!==base(records,q))return {ready:false,stale:true,missing:['成员、版本或阶段已变化，请撤回后重新发起']};
    if(q.target===3)return {ready:false,missing:['待 PM 记录提测会结论']};
    const missing=q.tasks.filter(t=>t.status!=='submitted'||t.context!==taskContext(records,q,t.role)).map(t=>roles[t.role]+(t.status==='submitted'?'内容已变化，需重新确认':t.status==='rejected'?'不通过':'待提交'));
    return {ready:!missing.length,missing};
  }
  function apply(input,action,ctx){
    const records=copy(input),r=records.find(x=>x.id===action.id);if(!r)throw Error('该事项已不存在，请刷新');
    const actor=ctx.actor||{},isAdmin=actor.kind==='creator',canEdit=id=>isAdmin||(ctx.editableIds||[]).includes(id);
    if(action.expected&&(action.expected.stage!==r.stage||action.expected.version!==(r.version||'')))throw Error('当前状态已变化，请重新打开后操作');
    const at=ctx.at||new Date().toISOString(),uid=()=>ctx.uid?ctx.uid():crypto.randomUUID();
    const editable=ids=>{if(!ids.some(canEdit))throw Error('由所属 PM 或已授权的维护人操作');};
    const date=()=>{const d=action.date===undefined?ctx.today:action.date;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d||d>ctx.today)throw Error('请填写不晚于今天的实际发生日期');return d;};
    const reason=()=>{const text=String(action.reason||'').trim();if(!text)throw Error('请填写本次操作原因');return text;};
    const history=(x,text,kind='flow',extra={})=>{x.history||=[];x.history.push({at,actor:actor.name,actorId:actor.id,kind,text,...extra});x.updated=at;};
    const cancel=(ids,why)=>requests(records).filter(q=>q.status==='collecting'&&q.memberIds.some(id=>ids.includes(id))).forEach(q=>{q.status='cancelled';q.closedAt=at;q.closedBy=actor.name;q.closedReason=why;});
    const snapshot=x=>({phaseDates:copy(x.phaseDates||{}),productionDates:copy(x.productionDates||{}),researchDates:copy(x.researchDates||{}),releaseConfirmedDate:x.releaseConfirmedDate||'',dateLinks:copy(x.dateLinks||{})});
    function setFact(x,path,value){window.LubanDateLinks?.edit(x,path,value);if(!window.LubanDateLinks){const [a,b,c]=path.split('.');x[a]||={};x[a][b]||={};x[a][b][c]=value;}}
    function resetCurrentRound(x,target){if(definition(x).kind==='research'){x.researchDates||={};if(target===12)x.researchDates.actualStart='';x.researchDates.actualEnd='';return;}const order=releasePath.indexOf(target),clear=(kind,id)=>{x[kind]||={};x[kind][id]||={};for(const field of ['actualStart','actualEnd']){x[kind][id][field]='';const path=(kind==='phaseDates'?'phase.'+id:'production.'+({单车:'single',编组:'group',灰度:'gray',上线:'launch'})[id])+'.'+field;x.dateLinks||={};x.dateLinks[path]={mode:'manual',clearedBy:'rollback',at};}};for(const [name,stage] of [['development',1],['testing',3]])if(order<=releasePath.indexOf(stage))clear('phaseDates',name);if(target===2){x.phaseDates||={};x.phaseDates.development||={};x.phaseDates.development.actualEnd='';x.dateLinks||={};x.dateLinks['phase.development.actualEnd']={mode:'manual',clearedBy:'rollback',at};}if(order<=releasePath.indexOf(4))clear('phaseDates','production');else{x.phaseDates||={};x.phaseDates.production||={};x.phaseDates.production.actualEnd='';x.dateLinks||={};x.dateLinks['phase.production.actualEnd']={mode:'manual',clearedBy:'rollback',at};}for(const [stage,name] of [[4,'单车'],[5,'编组'],[6,'灰度'],[8,'上线']])if(order<=releasePath.indexOf(stage))clear('productionDates',name);}
    function move(x,target,kind,actual,why='',requestId=''){
      const old=x.stage,beforeDates=snapshot(x);
      x.flowVisits||=[];x.flowVisits.push({id:uid(),from:old,to:target,kind,date:actual||'',at,actor:actor.name,actorId:actor.id,reason:why,version:x.version||'',requestId,beforeDates});
      if(kind==='rollback')resetCurrentRound(x,target);
      if(target!==8&&kind!=='correction')delete x.releaseConfirmedDate;
      x.stage=target;x.sourceStatus='';x.entered=actual||'';x.gate={pending:false,rd:false,qa:false,round:1,rejection:''};
      if(actual){
        if(definition(x).kind==='research'){x.researchDates||={};if(target===13)x.researchDates.actualStart=actual;if(target===14)x.researchDates.actualEnd=actual;}
        else {
          if(target===1)setFact(x,'phase.development.actualStart',actual);
          if(target===3)setFact(x,'phase.testing.actualStart',actual);
          if(kind==='advance'){if(old===10)setFact(x,'phase.demand.actualEnd',actual);if([1,2].includes(old)&&target>=3)setFact(x,'phase.development.actualEnd',actual);if(old===3&&target>=4)setFact(x,'phase.testing.actualEnd',actual);if(production[old]&&target>old)setFact(x,'production.'+({4:'single',5:'group',6:'gray'})[old]+'.actualEnd',actual);}
          if(production[target]){const key={4:'single',5:'group',6:'gray'}[target];setFact(x,'production.'+key+'.actualStart',actual);const first=definition(x).path.find(s=>[4,5,6].includes(s));if(target===first)setFact(x,'phase.production.actualStart',actual);}
          // R&D release confirmation is not a vehicle-upgrade execution date.
          if(target===8){x.releaseConfirmedDate=actual;setFact(x,'phase.production.actualEnd',actual);}
        }
      }
      history(x,(kind==='rollback'?'退回':kind==='correction'?'更正状态为':'进入')+label(target)+(why?'：'+why:''),kind,{from:old,to:target,date:actual||'',reason:why,requestId});
    }
    const check=q=>{if(!q||q.status!=='collecting')throw Error('当前没有待处理申请');if(q.base!==base(records,q))throw Error('成员、版本或当前阶段已变化，请撤回旧申请后重新发起');};
    if(action.type==='configure'){
      editable([r.id]);const original=copy(r),why=reason(),kind=action.kind==='research'?'research':'release',old=definition(r);
      let path=kind==='research'?researchPath.slice():(action.path||(old.kind==='release'?old.path:releasePath)).map(Number);
      if(kind==='release'&&(!path.length||path.at(-1)!==8||path.some((s,i)=>!releasePath.includes(s)||i&&releasePath.indexOf(path[i-1])>=releasePath.indexOf(s))))throw Error('发布流程请选择按顺序排列的阶段，并保留上线确认终点');
      if(old.kind===kind&&r.stage!==0&&r.stage!==11&&!path.includes(r.stage))throw Error('请保留当前阶段；需要退出时先明确推进或回退');
      const changedPaths=[];const affected=kind==='release'&&r.version?records.filter(x=>x.version===r.version&&definition(x).kind==='release'):[r];
      for(const x of affected){const beforeFlow=copy(x.workflow||{kind:'release',path:releasePath}),own=definition(x);const selected=x.id===r.id?path:[...own.path.filter(s=>s<4||s===10),...path.filter(s=>s>=4&&s!==10)];if(x.id!==r.id&&x.stage>=4&&!selected.includes(x.stage))throw Error('包内当前阶段需要保留，请先处理本次包的状态');if(JSON.stringify(own)!==JSON.stringify({kind:x.id===r.id?kind:own.kind,path:selected}))changedPaths.push(x.id);let planGaps=copy(x.workflow?.planGaps||{});if(action.planGaps){if(x.id===r.id)planGaps={};else for(const key of Object.keys(planGaps))if(Number(key.split('>')[0])>=4)delete planGaps[key];for(const [key,value] of Object.entries(action.planGaps)){if(!/^\d+>\d+$/.test(key)||!Number.isInteger(value)||value<0||value>3650)throw Error('排期间隔请填写 0～3650 的整数');const [a,b]=key.split('>').map(Number);if(x.id===r.id||a>=4)planGaps[key]=value;}}x.workflow={...(x.workflow||{}),kind:x.id===r.id?kind:own.kind,path:selected,planGaps};history(x,'适用流程已调整','change',{reason:why,items:[{label:'流程与排期间隔',before:describe(beforeFlow),after:describe(x.workflow)}]});}
      cancel(changedPaths,'适用流程已变更');
      if(old.kind!==kind){
        if(r.version){r.packageLineage||=[];const snap=original;delete snap.packageLineage;delete snap.flowRequests;delete snap.flowVisits;r.packageLineage.push({version:r.version,relation:'流程调整',at,actor:actor.name,reason:why,snapshot:snap});r.version='';}
        move(r,kind==='research'?12:0,'configure','',why);
      }
      if(kind==='research'){r.researchDates={...(r.researchDates||{}),plannedStart:action.plannedStart??r.researchDates?.plannedStart??'',plannedEnd:action.plannedEnd??r.researchDates?.plannedEnd??''};}
      return records;
    }
    if(action.type==='bind'){
      editable([r.id]);const why=reason(),version=String(action.version||'').trim();if(!version||version===r.version)throw Error('请填写不同的修复／替代包号');
      if(definition(r).kind!=='release')throw Error('请先选择适用的发布流程');
      const peers=records.filter(x=>x.id!==r.id&&x.version===version&&definition(x).kind==='release'),target=peers.length?peers[0].stage:Number(action.target??1);
      if(!releasePath.includes(target)||peers.some(x=>x.stage!==target))throw Error('请明确修复包的当前阶段');
      const snap=copy(r);delete snap.packageLineage;delete snap.flowRequests;delete snap.flowVisits;
      r.packageLineage||=[];if(r.version)r.packageLineage.push({version:r.version,relation:action.relation||'修复',replacement:version,at,actor:actor.name,reason:why,snapshot:snap});
      cancel([r.id,...peers.map(x=>x.id)],'修复／替代包关联已变更');
      r.version=version;r.productionDates=copy(peers[0]?.productionDates||{});r.phaseDates={};r.dateLinks={};delete r.releaseConfirmedDate;r.productionPlans=copy(peers[0]?.productionPlans||{'单车':'','编组':'','灰度':'','上线':''});r.launchDate=r.productionPlans['上线']||'';
      if(peers[0]?.workflow)r.workflow=copy(peers[0].workflow);
      move(r,target,'package-link','',why);history(r,'关联'+(action.relation||'修复')+'包 '+version,'package-link',{reason:why,previousVersion:snap.version});
      return records;
    }
    if(action.type==='start'){
      const target=nextTarget(records,r.id);if(target===null)throw Error('当前流程已结束；需要重新处理时请选择回退或关联修复包');
      const ids=scope(records,r.id,target);editable(ids);
      if(active(records,r.id))throw Error('已有进行中的申请，请继续处理该申请');
      const required=definition(r).kind==='research'?[]:target>=4&&target<=8?['rd','qa','domain','field']:target===3?['rd','qa']:[];
      if(!required.length){const actual=date();move(r,target,'advance',actual);return records;}
      const ms=ids.map(id=>records.find(x=>x.id===id));if(target>=4&&!r.version)throw Error('请先填写或关联本次发布包号');if(target>=4&&ms.some(x=>x.stage>8||x.stage<3&&definition(x).path.includes(3)))throw Error('包内仍有事项未完成研发准备，可先处理对应 FE');
      const q={id:uid(),memberIds:ids,version:target>=4?r.version||'':'',target,status:'collecting',createdAt:at,createdBy:actor.name,tasks:required.map(role=>({role,status:'pending',note:'',url:'',assigneeId:r.workflow?.assignees?.[role]||role})),events:[]};
      q.base=base(records,q);r.flowRequests||=[];r.flowRequests.push(q);history(r,'发起'+label(target)+'申请','request',{requestId:q.id});return records;
    }
    if(['submit','complete','withdraw','meeting'].includes(action.type)){
      const q=active(records,r.id);
      if(action.type==='withdraw'){if(!q)throw Error('当前没有待处理申请');editable(q.memberIds);q.status='withdrawn';q.closedAt=at;q.closedBy=actor.name;history(r,'撤回'+label(q.target)+'申请','request',{requestId:q.id});return records;}
      check(q);
      if(action.type==='meeting'){
        if(q.target!==3)throw Error('提测会结论只适用于本次进入实验室的申请');
        if(!isAdmin&&actor.kind!=='pm')throw Error('提测会结论由所属 PM 记录');
        editable(q.memberIds);
        if(!['passed','rejected'].includes(action.decision))throw Error('请选择通过或不通过');
        const url=String(action.url||'').trim();
        if(!url&&!isAdmin)throw Error('请填写提测会链接或名称');
        const passed=action.decision==='passed',actual=passed?date():'';
        q.meeting={decision:action.decision,url,recordedBy:{id:actor.id,name:actor.name,at},actualDate:actual};
        q.status=passed?'completed':'rejected';q.closedAt=at;q.closedBy=actor.name;
        if(passed){q.completedAt=at;q.completedBy=actor.name;q.actualDate=actual;for(const t of q.tasks){t.status='covered';t.coveredBy='meeting';}for(const x of members(records,q))if(x.stage<3||x.stage===10)move(x,3,'advance',actual,'提测会通过',q.id);}
        history(r,passed?'提测会通过，已记录进入实验室':'提测会不通过，当前阶段保持不变','meeting',{requestId:q.id,meeting:copy(q.meeting)});
        return records;
      }
      if(q.target===3)throw Error('请由 PM 根据提测会结论记录通过或不通过');
      if(action.type==='submit'){
        const t=q.tasks.find(t=>t.role===action.role);if(!t)throw Error('该申请没有这项确认');
        const allowed=isAdmin||(t.role==='field'?actor.kind==='pm'&&q.memberIds.some(canEdit):actor.id===t.assigneeId&&actor.kind===t.role);
        if(!allowed)throw Error('由该项责任人本人填写并确认');
        if(t.role==='field'&&q.tasks.some(x=>x.role!=='field'&&(x.status!=='submitted'||x.context!==taskContext(records,q,x.role))))throw Error('请先完成研发、质量和领域内部确认');
        const note=String(action.note??t.note??'').trim(),url=String(action.url??t.url??'').trim();
        if(!action.draft&&action.decision!=='rejected'&&!isAdmin&&['rd','qa'].includes(t.role)&&!url&&!members(records,q).some(x=>(x.documents||[]).some(d=>/^https?:\/\//.test(d.url))))throw Error('请关联本项所需报告后再确认');
        if(action.decision!==undefined&&!['passed','rejected'].includes(action.decision))throw Error('请选择通过或不通过');
        const status=action.draft?'draft':action.decision==='rejected'?'rejected':'submitted';
        if(t.status===status&&t.note===note&&t.url===url&&t.context===taskContext(records,q,t.role))return records;
        if(t.confirmedBy||t.rejectedBy){t.revisions||=[];t.revisions.push({status:t.status,note:t.note,url:t.url,confirmedBy:copy(t.confirmedBy),rejectedBy:copy(t.rejectedBy),context:t.context});}
        const signer={id:actor.id,name:actor.name,at,recordedByAdmin:isAdmin};
        t.note=note;t.url=url;t.status=status;t.context=taskContext(records,q,t.role);t.confirmedBy=status==='submitted'?signer:null;t.rejectedBy=status==='rejected'?signer:null;
        q.events.push({at,actor:actor.name,role:t.role,text:(status==='draft'?'保存内容：':status==='rejected'?'不通过：':'确认：')+roles[t.role]});return records;
      }
      editable(q.memberIds);if(!readiness(records,q).ready)throw Error('尚未齐备：'+readiness(records,q).missing.join('；'));
      const actual=date();q.status='completed';q.completedAt=at;q.completedBy=actor.name;q.actualDate=actual;
      for(const x of members(records,q))if(x.stage<q.target||x.stage===10)move(x,q.target,'advance',actual,'',q.id);
      return records;
    }
    if(action.type==='rollback'||action.type==='correct'){
      const target=Number(action.target),ids=scope(records,r.id,target),why=reason();editable(ids);
      if(action.type==='correct'&&!isAdmin)throw Error('录入纠错由系统管理员或单独授权人员操作');
      const path=definition(r).path;if(!path.includes(target))throw Error('请选择适用流程中的目标阶段');
      if(action.type==='rollback'&&(path.indexOf(target)>=path.indexOf(r.stage)||path.indexOf(r.stage)<0))throw Error('请选择早于当前阶段的回退目标');
      const actual=action.type==='rollback'?date():action.date?date():'';
      cancel(ids,why);
      for(const x of records.filter(x=>ids.includes(x.id))){if(action.type==='rollback'&&definition(x).path.indexOf(x.stage)<=definition(x).path.indexOf(target))continue;move(x,target,action.type==='rollback'?'rollback':'correction',actual,why);if(action.type==='rollback'){x.rollbacks||=[];x.rollbacks.push({id:uid(),at,date:actual,reason:why,stage:label(target),version:x.version||'',actor:actor.name,from:input.find(a=>a.id===x.id).stage,to:target});}}
      return records;
    }
    throw Error('未知流转动作');
  }
  window.LubanWorkflow={releasePath,researchPath,roles,label,definition,terminal,next,scope,active,readiness,apply,taskContext,target:nextTarget};
})();
