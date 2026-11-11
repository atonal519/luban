/* A single, local action surface for FE facts, requests and package lineage. */
window.createWorkflowUI=function(ctx){
  const M=window.LubanWorkflow,e=ctx.esc,$=id=>document.getElementById(id),dialog=$('workflow-dialog');
  let selected='',mode='home',dirty=new Set(),backdrop=null,openedFact=null,pendingLeave=null;
  const record=()=>ctx.getRecords().find(r=>r.id===selected);
  const allowed=r=>ctx.getActor().kind==='creator'||ctx.canEdit(r);
  const canRecordMeeting=r=>['creator','pm'].includes(ctx.getActor().kind)&&allowed(r);
  const button=(text,action,primary=false,extra='')=>'<button type="button" class="btn '+(primary?'primary':'')+'" data-flow-action="'+action+'" '+extra+'>'+e(text)+'</button>';
  const input=(id,title,value='',type='text')=>'<label class="form-field">'+e(title)+'<input id="flow-'+id+'" type="'+type+'" value="'+e(value)+'"></label>';
  const dateChoices=()=>'<div class="flow-date-choices"><button type="button" class="text-button" data-flow-action="occurrence-yesterday">昨天</button> · <button type="button" class="text-button" data-flow-action="occurrence-today">今天</button></div>';
  function occurrence(r,target){const info=window.LubanPackageDates.suggest(ctx.getRecords(),r.id,target,ctx.today);return input('date',(target===8?'上线确认完成日期':'实际进入日期')+(window.LubanPackageDates.paths[target]&&window.LubanPackageDates.members(ctx.getRecords(),r,target).length>1?'（整包）':''),info.value,'date')+dateChoices()+(info.conflict?'<p class="field-error">已有实际日期存在差异或晚于今天，请选择真实发生日期。</p>':'<p class="form-tip">'+(info.source==='recorded'?'已带入已记录的实际日期；可更正。':'补录请填写实际发生日期。')+'操作时间另行留痕。</p>');}
  const reason=()=>'<label class="form-field">原因<textarea id="flow-reason" maxlength="2000" placeholder="说明本次调整原因"></textarea></label>';
  const options=(values,current)=>values.map(([v,t])=>'<option value="'+e(v)+'" '+(String(v)===String(current)?'selected':'')+'>'+e(t)+'</option>').join('');
  const targetSelect=(r,values)=>'<label class="form-field">目标阶段<select id="flow-target">'+options(values.map(s=>[s,M.label(s)]),values[0])+'</select></label>';
  function summary(r){const q=M.active(ctx.getRecords(),r.id);if(!q)return '';const ready=M.readiness(ctx.getRecords(),q);return '<button type="button" class="flow-inline-summary" data-action="row-state" data-id="'+e(r.id)+'">申请'+e(M.label(q.target))+' · '+e(ready.ready?'待实际进入':ready.missing[0])+'</button>';}
  function taskList(){
    const actor=ctx.getActor(),out=[];
    for(const r of ctx.getRecords())for(const q of r.flowRequests||[]){if(q.status!=='collecting')continue;
      const ready=M.readiness(ctx.getRecords(),q);
      if(q.target===3){if(canRecordMeeting(r))out.push({id:r.id,title:r.title,version:q.version,label:'提测会结论 · PM记录'});continue;}
      q.tasks.forEach(t=>{if(t.status==='submitted'&&t.context===M.taskContext(ctx.getRecords(),q,t.role))return;
        if(actor.kind==='creator'||actor.id===t.assigneeId||t.role==='field'&&actor.kind==='pm'&&q.memberIds.some(id=>ctx.canEdit(ctx.getRecords().find(x=>x.id===id))))out.push({id:r.id,title:r.title,version:q.version,label:M.roles[t.role]});});
      if(ready.ready&&allowed(r))out.push({id:r.id,title:r.title,version:q.version,label:'待实际进入 · PM确认'});
    }return out;
  }
  function refreshTasks(){const b=$('workflow-tasks');if(b)b.textContent='我的待办 '+taskList().length;}
  function leave(fn){if(dirty.size){pendingLeave=fn;$('workflow-discard-dialog').showModal();return;}fn();}
  function close(){leave(()=>dialog.close());}
  function open(id){selected=id;mode='home';dirty.clear();draw();if(!dialog.open)dialog.showModal();}
  function evidenceMarkup(value,title){
    if(!value)return '';let href='';try{const url=new URL(value);if(['http:','https:'].includes(url.protocol))href=url.href;}catch{}
    return href?'<a href="'+e(href)+'" target="_blank" rel="noopener noreferrer">'+e(title)+'</a>':'<p class="flow-evidence-reference">'+e(value)+'</p>';
  }
  function showError(message,role,meeting=false){
    const scope=role?dialog.querySelector('[data-flow-role="'+role+'"]'):meeting?dialog.querySelector('.flow-meeting'):null,error=scope?.querySelector('[data-flow-error]')||$('flow-error');
    error.textContent=message;error.hidden=false;error.tabIndex=-1;error.focus({preventScroll:true});error.scrollIntoView({block:'nearest'});
  }
  function datesMarkup(snap){const phases={demand:'需求',development:'开发',testing:'测试',production:'生产'};return '<div class="flow-date-history">'+Object.entries(snap.phaseDates||{}).map(([key,d])=>'<p>'+e(phases[key]||key)+'：计划进入 '+e(d.expectedStart||'未填')+'，实际进入 '+e(d.actualStart||'未记录')+'，实际结束 '+e(d.actualEnd||'未记录')+'</p>').join('')+Object.entries(snap.productionDates||{}).map(([name,d])=>'<p>'+e(name)+'：实际进入 '+e(d.actualStart||'未记录')+'，实际结束 '+e(d.actualEnd||'未记录')+'</p>').join('')+(snap.releaseConfirmedDate?'<p>研发上线确认完成：'+e(snap.releaseConfirmedDate)+'</p>':'')+'</div>';}
  function history(r){
    const visits=r.flowVisits||[],lineage=r.packageLineage||[];
    const past=ctx.getRecords().flatMap(x=>x.flowRequests||[]).filter(q=>q.memberIds.includes(r.id));
    return (past.length?'<details class="flow-history"><summary>申请与确认记录 · '+past.length+' 次</summary>'+past.slice().reverse().map(q=>'<article><strong>'+e(M.label(q.target))+' · '+e(({collecting:'进行中',completed:'已完成',cancelled:'已取消',withdrawn:'已撤回',rejected:'未通过'})[q.status]||q.status)+'</strong><small> '+e(q.createdAt?.slice(0,10))+' · '+e(q.createdBy)+'</small>'+(q.meeting?'<p>'+e(q.meeting.decision==='passed'?'提测会通过':'提测会不通过')+' · '+e(q.meeting.recordedBy?.name)+' · '+e(q.meeting.actualDate||q.meeting.recordedBy?.at?.slice(0,10))+'</p>'+evidenceMarkup(q.meeting.url,'查看提测会依据'):'')+q.tasks.map(t=>'<div><p>'+e(M.roles[t.role])+'：'+e(t.status==='covered'?'由提测会结论覆盖':t.status==='submitted'?'已确认':t.status==='rejected'?'不通过':'未确认')+' · '+e(t.confirmedBy?.name||t.rejectedBy?.name||'')+'</p><p>'+e(t.note||'')+'</p>'+evidenceMarkup(t.url,'查看当时关联资料')+(t.revisions?.length?'<details><summary>历次反馈 · '+t.revisions.length+' 次</summary>'+t.revisions.map(v=>'<p>'+e(v.status==='rejected'?'不通过':'此前确认')+' · '+e(v.confirmedBy?.name||v.rejectedBy?.name||'')+'</p>'+evidenceMarkup(v.url,'查看当时资料')).join('')+'</details>':'')+'</div>').join('')+'</article>').join('')+'</details>':'')+(lineage.length?'<details class="flow-history"><summary>包关联历史 · '+lineage.length+' 次</summary>'+lineage.slice().reverse().map(x=>'<article><strong>'+e(x.version)+' → '+e(x.replacement||'流程调整')+'</strong><p>'+e(x.relation||'修复')+' · 原阶段 '+e(M.label(x.snapshot?.stage))+'</p><p>'+e(x.reason||'')+'</p><small>'+e(x.at?.slice(0,10))+' · '+e(x.actor)+'</small><details><summary>当时的阶段日期</summary>'+datesMarkup(x.snapshot||{})+'</details></article>').join('')+'</details>':'')+
      (visits.length?'<details class="flow-history"><summary>流转历史 · '+visits.length+' 次</summary>'+visits.slice().reverse().map(x=>'<article><strong>'+e(M.label(x.from))+' → '+e(M.label(x.to))+'</strong><p>'+e(x.reason||'')+'</p><small>'+e(x.date||'发生日期未记录')+' · '+e(x.actor)+' · '+e(x.version||'未关联包')+'</small><small>记录时间：'+e(ctx.time?ctx.time(x.at):x.at?.slice(0,16).replace('T',' ')||'')+'</small>'+((x.dateCorrections||[]).map(c=>'<p class="form-tip">实际日期更正：'+e(c.before||'未填')+' → '+e(c.after||'未填')+' · '+e(c.actor)+'</p>').join(''))+'<details><summary>变更前的阶段日期</summary>'+datesMarkup(x.beforeDates||{})+'</details></article>').join('')+'</details>':'');
  }
  function requestMarkup(r,q){
    const rows=ctx.getRecords(),actor=ctx.getActor(),ready=M.readiness(rows,q);
    if(q.target===3)return '<section class="flow-request flow-meeting"><h3>提测会结论</h3><p>通过后同时记录本次 FE 已进入实验室。</p>'+(canRecordMeeting(r)?'<label class="form-field">会议链接<input id="flow-meeting-url" type="text" aria-describedby="flow-meeting-error" placeholder="可填链接或会议名称"></label><p id="flow-meeting-error" class="field-error" data-flow-error role="alert" hidden></p>':'<p>待所属 PM 记录提测会结论。</p>')+'<p class="form-tip">会议关联占位；本次只处理当前提测申请。</p></section>';
    return '<section class="flow-request"><h3>申请'+e(M.label(q.target))+'</h3><p class="flow-request-state">'+e(ready.ready?'条件齐备 · 待实际进入':ready.missing.join('；'))+'</p>'+q.tasks.map(t=>{
      const submitted=t.status==='submitted'&&t.context===M.taskContext(rows,q,t.role),can=actor.kind==='creator'||actor.id===t.assigneeId||t.role==='field'&&actor.kind==='pm'&&q.memberIds.some(id=>allowed(rows.find(x=>x.id===id)));
      const blocked=t.role==='field'&&q.tasks.some(x=>x.role!=='field'&&(x.status!=='submitted'||x.context!==M.taskContext(rows,q,x.role)));
      return '<article class="flow-task" data-flow-role="'+t.role+'"><div class="flow-task-heading"><h4>'+e(M.roles[t.role])+'</h4><span>'+e(submitted?'已确认 · '+(t.confirmedBy?.name||''):t.status==='draft'?'草稿':t.status==='submitted'?'需重新确认':t.status==='rejected'?'不通过 · '+(t.rejectedBy?.name||''):'待提交')+'</span></div>'+
      (can?'<label class="form-field">资料链接<input data-task-url type="text" aria-describedby="flow-task-error-'+t.role+'" value="'+e(t.url||'')+'" placeholder="可填链接或资料说明" '+(blocked?'disabled':'')+'></label><p id="flow-task-error-'+t.role+'" class="field-error" data-flow-error role="alert" hidden></p><div class="flow-task-actions">'+button(t.role==='field'?'确认现场同意':submitted?'更新并确认准出':'确认准出','submit',true,blocked?'disabled':'')+button('不通过','reject',false,blocked?'disabled':'')+'</div>'+(blocked?'<p class="form-tip">先完成研发、质量和领域内部确认，再记录现场同意。</p>':''):(evidenceMarkup(t.url,'查看资料')||'<p>由对应责任人确认</p>'))+'</article>';
    }).join('')+'</section>';
  }
  function scopeHint(){const r=record();if(!r||!$('flow-scope'))return;let ids=[r.id];if(mode==='configure'){if(($('flow-kind')?.value||M.definition(r).kind)==='release'&&r.version)ids=ctx.getRecords().filter(x=>x.version===r.version&&M.definition(x).kind==='release').map(x=>x.id);}else if(mode==='rollback'||mode==='correct')ids=M.scope(ctx.getRecords(),r.id,Number($('flow-target')?.value));else if(mode==='home')ids=M.active(ctx.getRecords(),r.id)?.memberIds||M.scope(ctx.getRecords(),r.id,M.target(ctx.getRecords(),r.id));$('flow-scope').textContent=ids.length>1?'本次操作涉及整包 '+ids.length+' 项 FE，包含当前筛选外的成员。':'本次操作仅作用于当前 FE。';}
  function draw(){
    const r=record();dialog.dataset.recordId=selected;if(r)openedFact={stage:r.stage,version:r.version||''};if(mode!=='tasks'&&!r){dialog.close();return;}const actor=ctx.getActor(),flow=r&&M.definition(r),q=r&&M.active(ctx.getRecords(),r.id),can=r&&allowed(r);let body='',footer='',footerNote='状态变化、发生日期和操作记录一起保存';
    if(mode==='tasks')body='<div class="flow-todo-list">'+(taskList().length?taskList().map(t=>'<button type="button" data-flow-action="open-task" data-id="'+e(t.id)+'"><strong>'+e(t.title)+'</strong><span>'+e(t.version||'')+' · '+e(t.label)+'</span></button>').join(''):'<p>当前没有待办</p>')+'</div>';
    else{
      const target=M.target(ctx.getRecords(),r.id),ids=M.scope(ctx.getRecords(),r.id,target);
      body='<div class="flow-context"><strong>'+e(r.title)+'</strong><div>当前阶段：<b>'+e(M.label(r.stage))+'</b></div><div>适用流程：'+(flow.kind==='research'?'研究任务':'研发发布')+(r.version?' · 当前包 '+e(r.version):'')+'</div>'+'<p id="flow-scope"></p>'+'</div>';
      if(mode==='home'){
        body+=q?requestMarkup(r,q):'<div class="flow-next">'+(target!==null?'<p>下一阶段：'+e(M.label(target))+'</p>':'<p>当前流程已结束</p>')+
          (can&&target!==null?(flow.kind==='research'||[1,2].includes(target)?input('date','实际发生日期',ctx.today,'date')+button(flow.kind==='research'?(target===13?'开始研究':'结束研究'):target===1?'开始开发':'进入自测','start',true):button('发起推进','start',true)):'')+'</div>';
        if(!can)body+='<p class="flow-blocker">由所属 PM 或已授权的维护人发起、回退或调整流程；专业责任人可处理自己的待办。</p>';
        body+='<div class="flow-other-actions">'+(can?(flow.path.indexOf(r.stage)>0?button('发起回退','rollback'):'')+button('设置适用流程','configure')+(flow.kind==='release'?button('关联修复／替代包','bind'):'')+(q?button('撤回申请','withdraw'):''):'')+(actor.kind==='creator'?button('录入纠错','correct'):'')+'</div>'+(actor.kind==='creator'?'<p class="form-tip">补录已经发生的状态可用“录入纠错”，填写实际发生日期；只改实际日期可直接在阶段日期中整包更正。</p>':'')+history(r);
      if(q&&q.memberIds.some(id=>allowed(ctx.getRecords().find(x=>x.id===id)))){if(q.target===3&&canRecordMeeting(r)){footerNote='按提测会结论记录本次准入';footer='<div class="flow-footer-date">'+occurrence(r,q.target)+'</div>'+button('不通过','meeting-reject')+button('通过并进入实验室','meeting-pass',true);}else if(q.target!==3){const ready=M.readiness(ctx.getRecords(),q);footerNote=ready.ready?'实际发生后确认一次':ready.missing.join('；');footer=(ready.ready?'<div class="flow-footer-date">'+occurrence(r,q.target)+'</div>':'')+button(q.target===8?'确认上线阶段完成':'确认已进入'+M.label(q.target),'complete',true,ready.ready?'':'disabled');}}
      }else if(mode==='rollback'||mode==='correct'){
        const values=flow.path.filter(s=>s!==r.stage&&(mode==='correct'||flow.path.indexOf(s)<flow.path.indexOf(r.stage)));
        body+='<p>'+(mode==='rollback'?'选择退回目标并说明原因，提交后立即回退。':'用于更正误录，保留前后状态；留空日期不会补造实际日期。')+'</p>'+targetSelect(r,values)+reason()+input('date',mode==='rollback'?'实际回退日期':'正确发生日期（未知可留空）',mode==='rollback'?ctx.today:'','date')+dateChoices();
        footer=button(mode==='rollback'?'确认回退':'保存更正',mode==='rollback'?'save-rollback':'save-correct',true);
      }else if(mode==='configure'){
        body+='<label class="form-field">适用流程<select id="flow-kind">'+options([['release','研发发布'],['research','研究任务']],flow.kind)+'</select></label><div id="flow-path-options">'+pathOptions(r,flow.kind)+'</div>'+reason();
        if(q)body+='<p class="flow-blocker">调整适用阶段会撤回当前申请，已有填写和确认保留历史；只修改排期间隔不会撤回。</p>';
        if(r.version)body+='<p class="form-tip">切换为研究任务会结束当前包关联并保存历史。生产阶段选择按当前包统一调整。</p>';
        footer=button('保存流程','save-configure',true);
      }else if(mode==='bind'){
        body+='<p>保留原 FE，继续跟踪相关修复包或替代包。旧包与各轮进度保留历史。</p>'+input('version','修复／替代包号')+'<label class="form-field">关联方式<select id="flow-relation">'+options([['修复','修复'],['替代','替代'],['回退修复','回退修复']],'修复')+'</select></label>'+reason()+'<p class="form-tip">已有包承接其当前进度；新包从开发开始跟踪。此关联不会记录车辆已经升级或降级。</p>';footer=button('保存关联','save-bind',true);
      }
    }
    dialog.innerHTML='<div class="modal-heading"><h2 id="workflow-title">'+e(mode==='tasks'?'我的待办':mode==='rollback'?'发起回退':mode==='correct'?'录入纠错':'状态与流转')+'</h2>'+'<button type="button" class="btn icon-button" data-flow-action="close" aria-label="关闭状态流转">'+ctx.icon('close')+'</button>'+'</div><div class="modal-body">'+body+'<p id="flow-error" class="field-error" role="alert"></p></div><div class="modal-footer">'+(mode!=='home'&&mode!=='tasks'?button('返回','back'):'')+'<span class="footer-note">'+(mode==='tasks'?'责任人处理各自的填写与确认':e(footerNote))+'</span>'+footer+button('关闭','close')+'</div>';
    window.LubanSelect.enhance(dialog);scopeHint();
  }
  function pathOptions(r,kind){return kind==='research'?'<p>未开始 → 研究中 → 已结束；没有发布门禁。</p><div class="form-grid">'+input('planned-start','计划开始',r.researchDates?.plannedStart||'','date')+input('planned-end','计划结束',r.researchDates?.plannedEnd||'','date')+'</div>':'<fieldset class="flow-path"><legend>适用阶段</legend>'+M.releasePath.map(s=>'<label class="check-chip"><input type="checkbox" name="flow-stage" value="'+s+'" '+(s===8||M.definition(r).kind==='research'||M.definition(r).path.includes(s)?'checked':'')+' '+(s===8?'disabled':'')+'>'+e(M.label(s))+'</label>').join('')+'</fieldset><div id="flow-gap-options">'+gapOptions(r,M.definition(r).kind==='research'?M.releasePath:M.definition(r).path)+'</div>';}
  function gapOptions(r,path,prior={}){const nodes=[1,3,4,5,6,8].filter(x=>path.includes(x));return '<p class="form-tip">排期间隔按工作日计算；留空沿用相邻阶段的全局设置，跨阶段留空则保留手填。</p><div class="form-grid">'+nodes.slice(0,-1).map((from,i)=>{const to=nodes[i+1],key=from+'>'+to,value=prior[key]??r.workflow?.planGaps?.[key]??'';return '<label class="form-field">'+e(M.label(from))+' → '+e(M.label(to))+'<input type="number" min="0" max="3650" data-flow-gap="'+e(key)+'" value="'+e(value)+'" placeholder="工作日，可留空"></label>';}).join('')+'</div>';}
  function execute(type,extra={}){
    if(type==='complete'&&[...dirty].some(key=>key!=='form')){showError('还有未保存的责任人内容，请先保存或提交。');return;}
    const taskRole=extra.role,result=ctx.commit({type,id:selected,expected:openedFact,...extra});
    if(!result.ok){showError(result.message||'未能保存，请重试',taskRole,type==='meeting');return;}
    dirty.delete(taskRole||'form');refreshTasks();
    if(dirty.size){$('flow-error').textContent='此项已保存，另有未保存的内容。';return;}
    dialog.close();ctx.onSaved?.(selected);const messages={submit:(M.roles[extra.role]||'本项')+(extra.draft?'草稿已保存':extra.decision==='rejected'?'已记录不通过':'已保存'),rollback:'已退回'+M.label(extra.target),correct:'状态已更正为'+M.label(extra.target),meeting:extra.decision==='passed'?'提测会通过，已进入实验室':'已记录提测会不通过，当前阶段保持不变',configure:'适用流程已保存',bind:'已关联'+(extra.version||'修复包'),complete:'已确认'+M.label(record()?.stage),withdraw:'申请已撤回'};ctx.toast(type==='start'?(M.active(ctx.getRecords(),selected)?'申请已发起，当前阶段保持不变':'已记录'+M.label(record()?.stage)):messages[type]||'已保存');
  }
  function handleClick(b){const a=b.dataset.flowAction;if(!a)return false;
    if(a==='close'){close();return true;}
    if(a==='back'){leave(()=>{dirty.clear();mode='home';draw();});return true;}
    if(a==='open-task'){open(b.dataset.id);return true;}
    if(['rollback','correct','configure','bind'].includes(a)){leave(()=>{mode=a;dirty.clear();draw();});return true;}
    if(a==='occurrence-yesterday'||a==='occurrence-today'){const input=$('flow-date');if(input){input.value=a==='occurrence-today'?ctx.today:new Date(Date.parse(ctx.today+'T12:00:00Z')-86400000).toISOString().slice(0,10);input.dispatchEvent(new Event('change',{bubbles:true}));}return true;}
    if(a==='start')execute('start',{date:$('flow-date')?.value});
    if(a==='withdraw')leave(()=>{dirty.clear();execute('withdraw');});
    if(a==='meeting-pass'||a==='meeting-reject')execute('meeting',{decision:a==='meeting-pass'?'passed':'rejected',url:$('flow-meeting-url').value,date:$('flow-date').value});
    if(a==='reject'){const task=b.closest('[data-flow-role]');execute('submit',{role:task.dataset.flowRole,url:task.querySelector('[data-task-url]').value,decision:'rejected'});}
    if(a==='complete')execute('complete',{date:$('flow-date')?.value});
    if(a==='save-rollback'||a==='save-correct')execute(a==='save-rollback'?'rollback':'correct',{target:Number($('flow-target').value),reason:$('flow-reason').value,date:$('flow-date').value});
    if(a==='save-configure')execute('configure',{kind:$('flow-kind').value,path:[...dialog.querySelectorAll('[name="flow-stage"]:checked')].map(x=>Number(x.value)),reason:$('flow-reason').value,planGaps:Object.fromEntries([...dialog.querySelectorAll('[data-flow-gap]')].filter(x=>x.value!=='').map(x=>[x.dataset.flowGap,Number(x.value)])),plannedStart:$('flow-planned-start')?.value,plannedEnd:$('flow-planned-end')?.value});
    if(a==='save-bind')execute('bind',{version:$('flow-version').value,relation:$('flow-relation').value,reason:$('flow-reason').value,target:1});
    if(a==='submit'){const task=b.closest('[data-flow-role]');execute('submit',{role:task.dataset.flowRole,url:task.querySelector('[data-task-url]')?.value||''});}
    return true;
  }
  dialog.addEventListener('click',event=>{const b=event.target.closest('[data-flow-action]');if(b){event.stopPropagation();handleClick(b);}});
  dialog.addEventListener('input',event=>{const scope=event.target.closest('[data-flow-role],.flow-meeting');dirty.add(scope?.dataset.flowRole||'form');const error=scope?.querySelector('[data-flow-error]');if(error){error.textContent='';error.hidden=true;}});
  dialog.addEventListener('change',event=>{dirty.add(event.target.closest('[data-flow-role]')?.dataset.flowRole||'form');if(event.target.id==='flow-kind'){$('flow-path-options').innerHTML=pathOptions(record(),event.target.value);}if(event.target.name==='flow-stage'){const prior=Object.fromEntries([...dialog.querySelectorAll('[data-flow-gap]')].map(x=>[x.dataset.flowGap,x.value]));$('flow-gap-options').innerHTML=gapOptions(record(),[...dialog.querySelectorAll('[name="flow-stage"]:checked')].map(x=>Number(x.value)),prior);}scopeHint();});
  $('workflow-discard-dialog').addEventListener('cancel',()=>{pendingLeave=null;});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',event=>{backdrop=event.target===dialog&&outside(event)?event.pointerId:null;});
  dialog.addEventListener('pointerup',event=>{if(backdrop===event.pointerId&&event.target===dialog&&outside(event))close();backdrop=null;});
  $('workflow-discard-dialog').addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;$('workflow-discard-dialog').close();if(b.dataset.discard==='yes'){dirty.clear();const fn=pendingLeave;pendingLeave=null;fn?.();}else pendingLeave=null;});
  $('workflow-tasks').addEventListener('click',()=>ctx.guard(()=>{mode='tasks';dirty.clear();draw();if(!dialog.open)dialog.showModal();}));
  return {open,handleClick,summary,tasks:refreshTasks};
};
