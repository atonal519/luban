/* Today reads FE progress; FE details own progress entry and its history. */
window.createDailyUI=function(ctx){
  const {esc:e,icon,time,today,states,getRecords,getActor,getReviews,getDailyUpdates,save,advance,allPackages,openPackage,openDetail,toast,canEdit,pmName}=ctx;
  const $=id=>document.getElementById(id),M=window.LubanDailyModel,release=window.LubanReleaseModel;
  const conditions={normal:'正常',risk:'有风险',blocked:'受阻'};
  const conditionName=x=>conditions[x.condition]||'';
  const entryMeta=(x,withCondition=true)=>[dayLabel(x.date),x.origin!=='workbook'&&x.actor,withCondition&&conditionName(x)].filter(Boolean).map(e).join(' · ');
  const drafts=new Map();
  let bucket='today',phase='',query='',module='',status='all',selectedSimulation=null,active=false;
  const expandedPackages=new Set();
  const date=d=>d?d.slice(5).replace('-','/'):'未填';
  const dayLabel=d=>d===today?'今天 · '+d:(Date.parse(today)-Date.parse(d))/86400000===1?'昨天 · '+d:d;
  const draftKey=(t,key)=>JSON.stringify([t,key,today,getActor().id]);
  const entries=(type,key)=>getDailyUpdates().filter(x=>x.type===type&&x.key===key).sort((a,b)=>b.date.localeCompare(a.date)||b.at.localeCompare(a.at));
  const ownToday=(type,key)=>entries(type,key).find(x=>x.date===today&&x.actorId===getActor().id);
  const latest=(type,key)=>entries(type,key)[0];
  const current=(type,key)=>drafts.get(draftKey(type,key))||ownToday(type,key)||{text:'',condition:'normal'};
  function canWrite(type,key){
    const r=type==='fe'&&getRecords().find(r=>r.id===key);return r&&canEdit(r);
  }
  function matches(p){
    const members=p.members||[p];
    return (!module||members.some(r=>r.modules?.includes(module)))&&(!query||(p.version+' '+members.map(r=>[r.title,r.owner,pmName(r.pm)].join(' ')).join(' ')).toLowerCase().includes(query.toLowerCase()));
  }
  function todayMarkup(type,key){
    const others=entries(type,key).filter(x=>x.date===today&&x.actorId!==getActor().id);
    return others.length?'<div class="daily-other">'+others.map(x=>'<p><strong>'+entryMeta(x)+'</strong><br>'+e(x.text)+'</p>').join('')+'</div>':'';
  }
  function historyMarkup(type,key){
    const past=entries(type,key).filter(x=>x.date!==today),days=new Set(past.map(x=>x.date));
    return past.length?'<details class="daily-history"><summary>历史进展 · '+days.size+' 天</summary>'+past.map(x=>'<div><strong>'+entryMeta(x)+'</strong><p>'+e(x.text)+'</p>'+revisionMarkup(x)+'</div>').join('')+'</details>':'';
  }
  function revisionMarkup(x){
    return x.revisions?.length?'<details class="daily-revisions"><summary>修改记录 '+x.revisions.length+' 次</summary>'+x.revisions.slice().reverse().map(r=>'<p>'+e(r.text)+'<small>'+time(r.at)+'</small></p>').join('')+'</details>':'';
  }
  function editor(type,key,compact=false){
    const value=current(type,key),saved=ownToday(type,key),editable=canWrite(type,key),draft=drafts.has(draftKey(type,key)),imported=entries(type,key).some(x=>x.date===today&&x.origin==='workbook');
    const label=getRecords().find(r=>r.id===key)?.title||key;
    return '<div class="daily-editor" data-journal-type="'+type+'" data-journal-key="'+e(key)+'"><div class="daily-entry-heading"><h3 class="section-subtitle">今日进展</h3><span>'+e(today)+' · '+e(getActor().name)+'</span></div>'+(compact?'':todayMarkup(type,key))+'<textarea rows="4" maxlength="500" data-daily-text aria-label="'+e(label)+' 今日进展" placeholder="'+(imported?'补充今天的进展、问题或下一步…':'写下今天的进展、问题或下一步…')+'" '+(!editable?'disabled':'')+'>'+e(value.text)+'</textarea><div class="daily-entry-line"><select data-daily-condition aria-label="'+e(label)+' 跟进情况" '+(!editable?'disabled':'')+'>'+Object.entries(conditions).map(([v,l])=>'<option value="'+v+'" '+(value.condition===v?'selected':'')+'>'+l+'</option>').join('')+'</select><span class="daily-save-feedback" role="status" data-daily-feedback>'+(!editable?'由所属 PM 维护':draft?'未保存':saved?'已保存 · '+e(saved.actor)+' · '+time(saved.at):imported?'今日已更新 · 可补充进展':'今日未更新')+'</span></div>'+(compact?'':revisionMarkup(saved||{})+historyMarkup(type,key))+'</div>';
  }
  function feSummary(r,action='daily-open-fe'){
    const x=latest('fe',r.id);
    return '<article class="daily-fe-summary"><div><button type="button" class="fe-link" data-action="'+action+'" data-id="'+e(r.id)+'" title="'+e(r.title)+'">'+e(r.title)+'</button><small>'+e(r.sourceStatus||states[r.stage]?.label||'待核对')+'</small></div><div>'+(x?'<p>'+e(x.text)+'</p><small>'+entryMeta(x)+'</small>':'<small>尚未更新</small>')+'</div></article>';
  }
  function packageProgress(p,action='daily-open-fe'){return p.members.map(r=>feSummary(r,action)).join('');}
  function progressSummary(p){
    const updates=p.members.map(r=>latest('fe',r.id)).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date)||b.at.localeCompare(a.at));
    const changed=updates.filter(x=>x.date===today).length,risk=updates.filter(x=>x.condition==='risk').length,blocked=updates.filter(x=>x.condition==='blocked').length;
    return '<div class="progress-summary"><span>今日 '+changed+'/'+p.members.length+' 项已更新</span>'+(blocked?'<span class="progress-condition blocked">受阻 '+blocked+'</span>':'')+(risk?'<span class="progress-condition risk">有风险 '+risk+'</span>':'')+'</div>'+(updates[0]?'<div class="progress-summary-text" title="'+e(updates[0].text)+'">'+e(updates[0].text)+'</div><small class="muted">'+e(dayLabel(updates[0].date))+'</small>':'<span class="muted">尚无进展更新</span>');
  }
  function progressMarkup(r){
    const x=latest('fe',r.id);
    return '<section class="execution-progress"><div class="section-title-line"><h3>实际进展与风险</h3>'+(x&&conditionName(x)?'<span class="progress-condition '+e(x.condition)+'">'+e(conditionName(x))+'</span>':'')+'</div>'+(x?'<p class="execution-progress-text">'+e(x.text)+'</p><div class="execution-update-meta">'+entryMeta(x,false)+(x.origin!=='workbook'?' · '+time(x.at).slice(-5):'')+'</div>':'<p class="muted">尚无进展更新</p>')+'</section>';
  }
  function goalState(p,g){
    const request=window.LubanWorkflow?.active(getRecords(),p.members[0].id);if(request&&request.target===g.stage){const ready=window.LubanWorkflow.readiness(getRecords(),request);return {value:ready.ready?'confirmed':'pending',text:ready.ready?'条件齐备 · 待实际进入':ready.missing[0]};}
    const decision=p.members.some(r=>(r.flowVisits||[]).length)?null:release.decision(p,g.phase);
    if(decision)return {value:'confirmed',text:g.phase==='上线'?'已确认上线':'已准入'+g.phase};
    if(g.reached)return {value:'reached',text:'已在目标阶段'};
    return {value:'pending',text:!p.ready?'前置未齐':'待确认'};
  }
  function agendaItems(packages){
    return M.agenda(packages,today,bucket).map(p=>({...p,goals:p.goals.filter(g=>!phase||g.phase===phase)})).filter(p=>p.goals.length&&(status==='all'||p.goals.some(g=>goalState(p,g).value===status)));
  }
  function agendaRow(p){
    const opened=expandedPackages.has(p.version),review=ctx.packageReview(p),confirmed=['rd','qa','domain'].filter(key=>review.signs?.[key]).length;
    const request=window.LubanWorkflow?.active(getRecords(),p.members[0].id);const checks=request?window.LubanWorkflow.readiness(getRecords(),request).missing[0]||'条件齐备 · 待实际进入':!p.ready?'研发准备中':'尚未发起本次申请';
    const names=p.members.map(r=>r.title).join('；');
    const flagged=p.goals.some(g=>goalState(p,g).value==='confirmed');
    return '<tr data-daily-key="'+e(p.version)+'" class="'+(flagged?'daily-confirmed':'')+'"><td><strong>'+e(p.version)+'</strong><div class="daily-fe-names" title="'+e(names)+'">'+e(names)+'</div><span class="mobile-package-state">'+e(p.stageLabel)+'</span><div class="daily-title-sub">'+p.members.length+' 项内容 · <button type="button" class="text-button daily-expand" data-action="daily-expand" data-key="'+e(p.version)+'" aria-expanded="'+opened+'">'+(opened?'收起明细':'展开明细')+'</button></div></td><td class="daily-state">'+e(p.stageLabel)+'</td><td class="daily-target">'+p.goals.map(g=>{
      const state=goalState(p,g);return '<div class="daily-goal"><strong>'+e(g.phase)+' <time>'+(g.planned?date(g.planned):g.candidateDates.map(date).join(' / '))+'</time></strong><span class="agenda-status '+state.value+'">'+e(state.text)+'</span>'+(!g.reached&&state.value!=='confirmed'&&g.lateDays?'<small class="daily-late">逾期 '+g.lateDays+' 天</small>':'')+'</div>';
    }).join('')+'</td><td class="daily-pm">'+e(p.pms.join('、')||'未填')+'</td><td class="daily-checks"><span class="material-presence">'+(p.documents.length?'已关联 '+p.documents.length+' 份资料':'未关联资料')+'</span>'+'<small>'+e(checks)+'</small>'+'</td><td class="daily-summary">'+progressSummary(p)+'</td><td class="daily-operation"><div class="daily-actions"><button type="button" class="btn" data-action="daily-open" data-target-type="package" data-target-key="'+e(p.version)+'">核对／确认</button>'+simulateButton('package',p.version,'更新阶段')+'</div></td></tr>'+(opened?'<tr class="daily-expanded"><td colspan="7"><div class="expanded-content-heading"><strong>包内 FE 与最新进展</strong><span>点击 FE 查看或填写进展</span></div>'+packageProgress(p)+'</td></tr>':'');
  }
  function simulateButton(type,key,actionLabel){
    if(!ctx.workflowOpen)return '';
    const r=type==='package'?allPackages().find(p=>p.version===key)?.members[0]:getRecords().find(r=>r.id===key);
    return r?'<button type="button" class="btn" data-action="flow-open" data-id="'+e(r.id)+'">状态与流转</button>':'';
  }
  function paint(){
    if(!active)return;
    const packages=allPackages().filter(matches),items=agendaItems(packages);
    const count=name=>M.agenda(packages,today,name).length;
    const tabs=[['today','今日计划'],['overdue','已逾期'],['upcoming','未来三天']];
    $('aux-workspace').innerHTML='<div class="page-heading daily-heading"><div><div class="page-title"><h1>今日重点</h1><span class="total-label">'+e(today)+' · 周'+['日','一','二','三','四','五','六'][new Date(today+'T12:00:00Z').getUTCDay()]+'</span></div></div></div>'+
      '<div class="toolbar daily-toolbar"><div class="filters"><label class="search">'+icon('search')+'<input id="daily-search" aria-label="搜索今日事项" placeholder="搜索版本、FE 或负责人" value="'+e(query)+'"></label><select id="daily-module" data-inline-select class="book-select" aria-label="工作台模块"><option value="">全研发</option>'+ctx.data.modules.map(m=>'<option '+(module===m?'selected':'')+'>'+e(m)+'</option>').join('')+'</select></div><div class="daily-list-actions"><select id="daily-status" data-inline-select class="book-select" aria-label="确认状态筛选">'+[['all','全部状态'],['pending','待确认'],['confirmed','已确认'],['reached','已在目标阶段']].map(([v,label])=>'<option value="'+v+'" '+(status===v?'selected':'')+'>'+label+'</option>').join('')+'</select><button class="btn" data-action="daily-expand-all">全部展开</button><button class="btn" data-action="daily-collapse-all">全部收起</button></div></div>'+
      '<div class="view-tabs daily-buckets" aria-label="今日计划分类">'+tabs.map(([v,l])=>'<button class="view-tab '+(bucket===v?'active':'')+'" data-action="daily-bucket" data-daily-bucket="'+v+'">'+l+' <span>'+count(v)+'</span></button>').join('')+'</div><div class="daily-phases" aria-label="生产目标阶段">'+['','单车','编组','灰度','上线'].map(p=>'<button class="text-button '+(phase===p?'active':'')+'" data-action="daily-phase" data-phase="'+p+'">'+(p||'全部阶段')+'</button>').join('')+'</div>'+
      '<section class="table-region daily-table-region"><table class="book-table daily-table"><colgroup>'+[205,100,150,85,135,235,165].map(w=>'<col style="width:'+w+'px">').join('')+'</colgroup><thead><tr>'+['版本包／FE','当前阶段','计划进入与确认','所属 PM','资料与确认','FE 进展摘要','操作'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody id="daily-rows">'+items.map(agendaRow).join('')+'</tbody></table>'+(!items.length?'<div class="empty"><strong>当前没有符合条件的事项</strong><p>可调整阶段或确认状态筛选。</p><button class="btn" data-action="daily-clear">查看当前分类全部计划</button></div>':'')+'</section><p class="daily-footnote">'+items.length+' 个版本 · 发布确认后继续保留当天安排</p>';
    $('aux-workspace').querySelectorAll('[data-action="daily-bucket"],[data-action="daily-phase"]').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))));
    $('daily-search').oninput=event=>{const position=event.target.selectionStart;query=event.target.value;paint();$('daily-search').focus();$('daily-search').setSelectionRange(position,position);};
    $('daily-module').onchange=event=>{module=event.target.value;paint();};
    $('daily-status').onchange=event=>{status=event.target.value;paint();};
    window.LubanSelect.enhance($('aux-workspace'));
  }
  function captureDraft(el){
    const root=el.closest('.daily-editor');if(!root)return;
    const type=root.dataset.journalType,key=root.dataset.journalKey;
    if(!canWrite(type,key))return;
    const text=root.querySelector('[data-daily-text]').value,condition=root.querySelector('[data-daily-condition]').value,prior=ownToday(type,key);
    if(text===(prior?.text||'')&&condition===(prior?.condition||'normal'))drafts.delete(draftKey(type,key));
    else drafts.set(draftKey(type,key),{text,condition});
    root.querySelector('[data-daily-feedback]').textContent=drafts.has(draftKey(type,key))?'未保存':prior?'已保存 · '+time(prior.at):'今日未更新';
  }
  function saveJournal(root){
    const type=root.dataset.journalType,key=root.dataset.journalKey;if(!canWrite(type,key))return;
    captureDraft(root.querySelector('[data-daily-text]'));
    const value=current(type,key),actor=getActor();
    try{
      const next=M.saveEntry(getDailyUpdates(),{type,key,date:today,actorId:actor.id,actor:actor.name,text:value.text,condition:value.condition,at:new Date().toISOString()});
      const positions=[...document.querySelectorAll('.table-region,.drawer-scroll')].map(el=>({selector:el.id?'#'+el.id:'.'+[...el.classList].join('.'),top:el.scrollTop,left:el.scrollLeft}));
      if(!save(getRecords(),getReviews(),next)){const currentRoot=root.isConnected?root:findEditor(type,key);currentRoot.querySelector('[data-daily-feedback]').textContent='未能保存，输入已保留';return;}
      drafts.delete(draftKey(type,key));paint();refreshPanels(true);
      positions.forEach(p=>{const el=document.querySelector(p.selector);if(el){el.scrollTop=p.top;el.scrollLeft=p.left;}});
      toast('今日进展已保存');
    }catch(error){root.querySelector('[data-daily-feedback]').textContent=error.message;}
  }
  const findEditor=(type,key)=>[...document.querySelectorAll('.daily-editor')].find(el=>el.dataset.journalType===type&&el.dataset.journalKey===key);
  function legacyMarkup(version){
    const list=entries('package',version);if(!list.length)return '';
    return '<details class="daily-history daily-legacy"><summary>原整包进展 · '+list.length+' 条</summary>'+list.map(x=>'<article class="daily-record"><strong>'+e(x.date)+' · '+e(conditionName(x))+'</strong><p>'+e(x.text)+'</p><small>'+e(x.actor)+' · '+time(x.at)+'</small>'+revisionMarkup(x)+'</article>').join('')+'</details>';
  }
  function recordMarkup(r){
    return editor('fe',r.id)+(r.version?legacyMarkup(r.version):'');
  }
  const recordStageMarkup=r=>'';
  function packageMarkup(version){
    const p=allPackages().find(p=>p.version===version);if(!p)return '';
    return '<section class="package-daily"><h3 class="section-subtitle">FE 最新进展</h3>'+packageProgress(p,'book-open-record')+legacyMarkup(version)+'</section>';
  }
  function refreshPanels(progressSaved=false){
    const detail=$('detail');if(detail?.open&&$('panel-daily')){
      const id=ctx.getSelectedId();const r=getRecords().find(r=>r.id===id);if(r){$('panel-daily').innerHTML=recordMarkup(r);ctx.onProgressSaved?.(r,{progressSaved});}
    }
  }
  document.addEventListener('input',event=>{if(event.target.matches('[data-daily-text]'))captureDraft(event.target);});
  document.addEventListener('change',event=>{if(event.target.matches('[data-daily-condition]'))captureDraft(event.target);});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&event.target.matches('[data-daily-text]')){event.preventDefault();saveJournal(event.target.closest('.daily-editor'));}});
  window.addEventListener('beforeunload',event=>{if(drafts.size){event.preventDefault();event.returnValue='';}});
  function handleClick(button){
    const action=button.dataset.action;
    if(action==='daily-expand-all'||action==='daily-collapse-all'){
      agendaItems(allPackages().filter(matches)).forEach(p=>action==='daily-expand-all'?expandedPackages.add(p.version):expandedPackages.delete(p.version));paint();return true;
    }
    if(action==='daily-clear'){status='all';phase='';query='';module='';paint();return true;}
    if(action==='daily-bucket'){bucket=button.dataset.dailyBucket;paint();return true;}
    if(action==='daily-phase'){phase=button.dataset.phase;paint();return true;}
    if(action==='daily-save'){const root=button.closest('.daily-editor')||[...document.querySelectorAll('#detail .daily-editor')].find(el=>el.checkVisibility());if(root)saveJournal(root);return true;}
    if(action==='daily-expand'){const key=button.dataset.key,region=document.querySelector('.daily-table-region'),top=region?.scrollTop||0;expandedPackages.has(key)?expandedPackages.delete(key):expandedPackages.add(key);paint();const next=document.querySelector('.daily-table-region');if(next)next.scrollTop=top;[...document.querySelectorAll('.daily-expand')].find(el=>el.dataset.key===key)?.focus({preventScroll:true});return true;}
    if(action==='flow-open'){ctx.workflowOpen(button.dataset.id);return true;}
    if(action==='daily-simulate'){const r=button.dataset.targetType==='package'?allPackages().find(p=>p.version===button.dataset.targetKey)?.members[0]:getRecords().find(r=>r.id===button.dataset.targetKey);if(r)ctx.workflowOpen(r.id);return true;}
    if(action==='confirm-simulate'){return true;}
    if(action==='close-simulate'){$('simulate-dialog').close();selectedSimulation=null;return true;}
    if(action==='daily-open'){if(button.dataset.targetType==='package')openPackage(button.dataset.targetKey);else openDetail(button.dataset.targetKey);return true;}
    if(action==='daily-open-fe'){
      if($('package-dialog').open)$('package-dialog').close();
      openDetail(button.dataset.id);return true;
    }
    return false;
  }
  return {paint,handleClick,recordMarkup,recordStageMarkup,quickMarkup:r=>editor('fe',r.id,true),packageMarkup,progressMarkup,setActive:value=>active=value,clearDrafts:()=>drafts.clear(),hasDrafts:()=>drafts.size>0};
};
