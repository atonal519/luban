/* Workbook views reuse the FE editor and one browser-local save operation. */
window.createWorkbookUI = function (ctx) {
  const {data:D, esc:e, icon, time, today, states, getRecords, getActor, getReviews, save, advance, openDetail, toast, requestLeave,pmName=value=>value} = ctx;
  const $ = id => document.getElementById(id);
  const rowsById = new Map(D.sourceRows.map(r => [r.id,r]));
  let workspace='fe', selectedPackage='', packageScope='all', packageSearch='', sourceSheet=D.sheets[0]?.name||'', sourceSearch='';
  let stagedNote='', lastNotice='';
  const expandedVersions=new Set();
  const phaseKeys=['单车','编组','灰度','上线'];
  const release=window.LubanReleaseModel;
  const display = v => v ? e(v) : '<span class="muted">—</span>';
  const safeURL = value => {try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};

  function allPackages() {
    const grouped=new Map();
    getRecords().forEach(r=>{if(r.version&&r.workflow?.kind!=='research'){if(!grouped.has(r.version))grouped.set(r.version,[]);grouped.get(r.version).push(r);}});
    return [...grouped].map(([version,members])=>{
      const plans={}, planCandidates={};
      phaseKeys.forEach(p=>{
        const code=({单车:4,编组:5,灰度:6,上线:8})[p],applicable=members.every(r=>!r.workflow?.path||r.workflow.path.includes(code));const vals=applicable?[...new Set(members.map(r=>r.productionPlans?.[p]).filter(Boolean))]:[];
        planCandidates[p]=vals.slice().sort();
        plans[p]=vals.length===1?vals[0]:'';
      });
      const {stage,ready}=window.LubanGrouping.packageState(members);
      // Mixed FE histories do not establish one shared actual stage. The next
      // authorization starts with the earliest member still needing admission.
      const cursor=stage??(ready?Math.min(...members.map(r=>r.stage)):null);
      const currentMember=members.find(r=>r.stage===cursor);const target=currentMember&&window.LubanWorkflow?window.LubanWorkflow.next(currentMember):cursor===3?4:cursor===6||cursor===7?8:cursor===4||cursor===5?cursor+1:null;
      const phase=({4:'单车',5:'编组',6:'灰度',8:'上线'})[target]||'';
      const due=phase?planCandidates[phase][0]||'':phaseKeys.flatMap(p=>planCandidates[p]).filter(d=>d&&d<=today).sort()[0]||'';
      const owners=[...new Set(members.map(r=>r.owner).filter(Boolean))],pms=[...new Set(members.map(r=>pmName(r.pm)).filter(Boolean))];
      const documents=[...new Map(members.flatMap(r=>r.documents||[]).filter(d=>safeURL(d.url)).map(d=>[d.url,d])).values()];
      const result={version,members,stage,ready,target,phase,plans,planCandidates,owners,pms,documents,due,review:getReviews()[version]||{},stageLabel:stage===null?(ready?[...new Set(members.map(r=>r.stage))].sort((a,b)=>a-b).map(s=>states[s].label).join(' / '):'研发准备中'):states[stage].label};
      if(stage===8&&release.decision(result,'上线'))result.stageLabel='已确认上线';
      return result;
    });
  }
  const findPackage=version=>allPackages().find(p=>p.version===version);
  const planText=(p,phase,short=false)=>p.members.some(r=>r.workflow?.path&&!r.workflow.path.includes(({单车:4,编组:5,灰度:6,上线:8})[phase]))?'不适用':(p.planCandidates[phase]||[]).map(d=>short?d.slice(5).replace('-','/'):d).join(' / ')||'未填';
  const dateLinks=window.LubanDateLinks;
  const endPaths={单车:'production.single.expectedEnd',编组:'production.group.expectedEnd',灰度:'production.gray.expectedEnd',上线:'production.launch.expectedEnd'};
  const signature=p=>JSON.stringify(p.members.map(r=>[r.id,r.stage,r.title,r.owner,r.version,r.productionPlans,phaseKeys.map(k=>dateLinks.material(r,endPaths[k])),r.documents,r.description,r.metric]));
  const priorSignature=p=>JSON.stringify(p.members.map(r=>[r.id,r.stage,r.title,r.owner,r.version,r.productionPlans,phaseKeys.map(k=>dateLinks.reviewValue(r,endPaths[k])),r.documents,r.description,r.metric]));
  const legacySignature=p=>JSON.stringify(p.members.map(r=>[r.id,r.stage,r.title,r.owner,r.version,r.productionPlans,r.documents,r.description,r.metric]));
  function currentReview(p) {
    const unchangedLegacy=p.members.every(r=>phaseKeys.every(k=>!dateLinks.material(r,endPaths[k])))&&p.review.signature===legacySignature(p);
    return p.review.signature===signature(p)||p.review.signature===priorSignature(p)||unchangedLegacy?p.review:{signs:{},events:p.review.events||[],decisions:p.review.decisions||{}};
  }
  function sourceCell(value) {
    const text=String(value||'');
    if(!text)return '<span class="muted">—</span>';
    if(text.length>180)return '<details class="cell-long"><summary>'+e(text.slice(0,110))+'…</summary><div>'+e(text)+'</div></details>';
    const url=safeURL(text);
    return url?'<a href="'+e(url)+'" target="_blank" rel="noopener noreferrer">打开原文链接 ↗</a>':e(text);
  }
  function rowMarkup(row) {
    return '<details class="source-record"><summary>'+e(row.sheet)+' · 第 '+row.row+' 行</summary><dl>'+Object.entries(row.values).map(([k,v])=>'<div><dt>'+e(k)+'</dt><dd>'+sourceCell(v)+'</dd></div>').join('')+'</dl></details>';
  }
  function recordSourceMarkup(r) {
    return '<p class="section-description">查看关联资料中的记录。</p>'+ (r.sourceRefs?.map(id=>rowsById.get(id)).filter(Boolean).map(rowMarkup).join('')||'<p class="muted">暂无关联数据。</p>');
  }
  function shell(title, subtitle, controls, body) {
    $('aux-workspace').innerHTML='<div class="page-heading"><div><div class="page-title"><h1>'+e(title)+'</h1></div><p class="section-description">'+e(subtitle)+'</p></div></div>'+controls+body;
  }
  function renderPackages() {
    const all=allPackages(),list=all.filter(p=>(packageScope==='all'||p.due&&p.due<=today&&p.stage!==8)&&(!packageSearch||(p.version+' '+p.members.map(r=>r.title).join(' ')).toLowerCase().includes(packageSearch.toLowerCase())));
    shell('版本管理','核对版本、排期与资料是否齐全，专业准出由对应责任人确认。',
      '<div class="toolbar"><div class="filters"><label class="search">'+icon('search')+'<input id="package-search" aria-label="搜索版本" placeholder="搜索版本或 FE" value="'+e(packageSearch)+'"></label><select id="package-scope" data-inline-select class="book-select" aria-label="版本视图"><option value="all" '+(packageScope==='all'?'selected':'')+'>全部版本</option><option value="today" '+(packageScope==='today'?'selected':'')+'>今日待核对</option></select></div><span class="muted">'+list.length+' / '+all.length+' 个版本</span></div>',
      '<section class="table-region book-table-region"><table class="book-table version-list"><colgroup>'+[180,100,300,140,120,140,130].map(w=>'<col style="width:'+w+'px">').join('')+'</colgroup><thead><tr>'+['版本包','当前阶段','生产排期 · 计划进入','责任人','关联资料','本次确认','操作'].map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody id="package-rows">'+list.map(p=>{
        const review=currentReview(p),confirmed=Object.values(review.signs||{}).filter(Boolean).length,opened=expandedVersions.has(p.version);
        const flowRequest=window.LubanWorkflow?.active(getRecords(),p.members[0].id);const flowReady=flowRequest&&window.LubanWorkflow.readiness(getRecords(),flowRequest);
        const progress=flowRequest?(flowReady.ready?'待实际进入':flowReady.missing[0]):release.decision(p,p.phase)?(p.phase==='上线'?'已确认上线':'已准入'+p.phase):p.stage===8?'上线阶段已完成':!p.ready?'前置环节未齐':'内部 '+confirmed+'/3';
        return '<tr data-package="'+e(p.version)+'"><td><strong>'+e(p.version)+'</strong><span class="mobile-package-state">'+e(p.stageLabel)+'</span><div class="version-count">'+p.members.length+' 项内容 · <button class="text-button" data-action="version-expand" data-version="'+e(p.version)+'" aria-expanded="'+opened+'">'+(opened?'收起明细':'展开明细')+'</button></div></td><td class="version-stage">'+e(p.stageLabel)+'</td><td class="version-plans"><div class="version-plan-pairs">'+phaseKeys.map(key=>'<span class="'+(p.phase===key?'next-target':'')+'"><span>'+key+'</span><strong>'+e(planText(p,key,true))+'</strong></span>').join('')+'</div></td><td class="version-responsibility"><div title="'+e(p.pms.join('、'))+'">PM '+display(p.pms.join('、'))+'</div><div class="version-people" title="'+e(p.owners.join('、'))+'">研发 '+display(p.owners.join('、'))+'</div></td><td class="version-materials">'+(p.documents.length?'已关联 '+p.documents.length+' 份资料':'<span class="text-warning">未关联资料</span>')+'</td><td class="version-confirmation"><span>'+e(progress)+'</span>'+(p.phase?'<div class="table-subtext">下一步：'+e(p.phase)+'</div>':'')+'</td><td class="version-operation"><button class="btn" data-action="open-package" data-version="'+e(p.version)+'">'+(p.stage===8?'查看记录':'查看／核对')+'</button></td></tr>'+(opened?'<tr class="version-expanded"><td colspan="7">'+dailyUI.packageMarkup(p.version)+'</td></tr>':'');
      }).join('')+'</tbody></table>'+(list.length?'':'<div class="empty"><strong>没有符合条件的版本</strong><p>可切换到全部版本查看未来计划或待补计划。</p></div>')+'</section>');
    $('package-scope').onchange=event=>{packageScope=event.target.value;renderPackages();};
    window.LubanSelect.enhance($('aux-workspace'));
    $('package-search').oninput=event=>{const position=event.target.selectionStart;packageSearch=event.target.value;renderPackages();$('package-search').focus();$('package-search').setSelectionRange(position,position);};
  }
  function renderSources() {
    if(!D.sheets.length){
      shell('数据记录','查看历史资料，与 FE 和版本信息核对。','',
        '<div class="empty"><strong>暂无源表数据</strong><p>可先在需求池或 FE 清单新增工作。</p><button class="btn" id="reset">恢复初始数据</button></div>');
      $('reset').onclick=()=>$('reset-dialog').showModal();
      return;
    }
    const sheet=D.sheets.find(s=>s.name===sourceSheet), rows=D.sourceRows.filter(r=>r.sheet===sourceSheet&&(!sourceSearch||Object.values(r.values).join(' ').toLowerCase().includes(sourceSearch.toLowerCase())));
    shell('数据记录','查看历史资料，与 FE 和版本信息核对。',
      '<div class="toolbar"><div class="filters"><select id="source-sheet" data-inline-select class="book-select" aria-label="选择工作表">'+D.sheets.map(s=>'<option '+(s.name===sourceSheet?'selected':'')+'>'+e(s.name)+'</option>').join('')+'</select><label class="search">'+icon('search')+'<input id="source-search" placeholder="搜索当前工作表" value="'+e(sourceSearch)+'"></label></div><span class="muted">'+rows.length+' 行 · 全部共 '+D.sourceRows.length+' 行</span></div>',
      '<section class="table-region source-table-region"><table id="source-table" class="book-table source-table"><thead><tr><th>原行号</th>'+sheet.headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody id="source-rows">'+rows.map(r=>'<tr><th scope="row">'+r.row+'</th>'+sheet.headers.map(h=>'<td>'+sourceCell(r.values[h])+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>');
    $('aux-workspace').querySelector('.page-heading').insertAdjacentHTML('beforeend','<button class="btn" id="reset">恢复初始数据</button>');
    $('reset').onclick=()=>$('reset-dialog').showModal();
    $('source-sheet').onchange=event=>{sourceSheet=event.target.value;sourceSearch='';renderSources();};
    window.LubanSelect.enhance($('aux-workspace'));
    $('source-search').oninput=event=>{const position=event.target.selectionStart;sourceSearch=event.target.value;renderSources();$('source-search').focus();$('source-search').setSelectionRange(position,position);};
  }
  function setWorkspace(name) {
    if(name==='review')name='source';
    requestLeave(()=>{
      if($('detail').open)$('detail').close();
      workspace=name;$('fe-workspace').hidden=name!=='fe';$('aux-workspace').hidden=name==='fe';
      dailyUI.setActive(name==='today');ctx.reportingUI.setActive(name==='reports');
      document.querySelectorAll('[data-action="book-workspace"]').forEach(el=>el.classList.toggle('active',el.dataset.workspace===(name==='reports'?'today':name)));
      $('breadcrumb-section').textContent=name==='settings'?'设置':'研发';
      $('breadcrumb-current').textContent=({demand:'需求池',today:'今日重点',reports:'今日重点',fe:'FE 清单',versions:'版本管理',source:'数据记录',settings:'研发排期'})[name];
      history.replaceState(null,'','#'+name);refresh();
    });
  }
  function refresh() {
    const region=$('aux-workspace').querySelector('.table-region'),position=region&&{className:region.className,top:region.scrollTop,left:region.scrollLeft};
    if(workspace==='demand')ctx.intakeUI.render();if(workspace==='today'){dailyUI.paint();const nav=document.createElement('nav');nav.className='report-workspace-tabs';nav.setAttribute('aria-label','今日重点分区');nav.innerHTML='<button class="text-button active" data-action="book-workspace" data-workspace="today">发布计划</button><button class="text-button" data-action="book-workspace" data-workspace="reports">进度收集</button>';$('aux-workspace').prepend(nav);}if(workspace==='reports')ctx.reportingUI.render();if(workspace==='versions')renderPackages();if(workspace==='source')renderSources();if(workspace==='settings')ctx.planningUI.renderPage();
    const next=$('aux-workspace').querySelector('.table-region');
    if(position&&next?.className===position.className){next.scrollTop=position.top;next.scrollLeft=position.left;}
  }
  function materials(p) {
    const docs=p.documents;
    return docs.length?docs.map(d=>{const href=safeURL(d.url);return href?'<a href="'+e(href)+'" target="_blank" rel="noopener noreferrer">'+e(d.name)+' ↗</a>':'';}).join('<br>'):'<span class="muted">未关联审核材料。</span>';
  }
  function drawFlowPackage(p) {
    const q=window.LubanWorkflow.active(getRecords(),p.members[0].id),ready=q&&window.LubanWorkflow.readiness(getRecords(),q);
    const prior=p.review||{};
    $('package-dialog').innerHTML='<div class="modal-heading"><h2 id="package-title">'+e(p.version)+' · 整包流转</h2><button class="btn icon-button" data-action="close-package" aria-label="关闭版本核对">'+icon('close')+'</button></div><div class="modal-body"><div class="package-transition"><strong>'+e(p.stageLabel)+'</strong><span>'+p.members.length+' 项 FE</span></div><p class="flow-blocker">'+e(q?(ready.ready?'条件齐备 · 待实际进入':ready.missing.join('；')):'点击状态与流转，发起推进、回退或处理修复包关联。')+'</p><section class="package-check-section"><div class="section-title-line"><h3>关联资料</h3><span>已关联 '+p.documents.length+' 份</span></div><div class="gate-material">'+materials(p)+'</div></section><details class="package-content"><summary>包内 FE 与进展 · '+p.members.length+' 项</summary>'+dailyUI.packageMarkup(p.version)+'</details><details class="package-content"><summary>生产排期 · 计划进入</summary><div class="package-plan-grid">'+phaseKeys.map(key=>'<div><span>'+key+'</span><strong>'+e(planText(p,key))+'</strong></div>').join('')+'</div></details><details class="history"><summary>已有确认记录 · '+(prior.events||[]).length+' 条</summary><ol>'+(prior.events||[]).slice().reverse().map(x=>'<li><strong>'+e(x.text)+'</strong><p>'+e(x.note||'')+'</p><time>'+time(x.at)+' · '+e(x.actor)+'</time></li>').join('')+'</ol></details><p id="package-error" class="field-error" role="alert"></p></div><div class="modal-footer"><span class="footer-note">专业确认、实际阶段及车辆升级分别记录</span><button type="button" class="btn" data-action="close-package">关闭</button><button type="button" class="btn primary" data-action="package-workflow" data-id="'+e(p.members[0].id)+'">状态与流转</button></div>';
  }
  function drawPackage(){const p=findPackage(selectedPackage);if(p)drawFlowPackage(p);}
  function openPackage(version) {
    selectedPackage=version;stagedNote='';lastNotice='';$('package-dialog').style.height='';$('package-dialog').innerHTML='';drawPackage();$('package-dialog').showModal();
  }
  function handleClick(button) {
    if(ctx.planningUI.handleClick(button))return true;
    if(dailyUI.handleClick(button))return true;
    const action=button.dataset.action;
    if(action==='book-workspace'){setWorkspace(button.dataset.workspace);return true;}
    if(action==='open-package'){openPackage(button.dataset.version);return true;}
    if(action==='version-expand'){const key=button.dataset.version,region=document.querySelector('.book-table-region'),top=region?.scrollTop||0;expandedVersions.has(key)?expandedVersions.delete(key):expandedVersions.add(key);renderPackages();const next=document.querySelector('.book-table-region');if(next)next.scrollTop=top;[...document.querySelectorAll('[data-action="version-expand"]')].find(el=>el.dataset.version===key)?.focus({preventScroll:true});return true;}
    if(action==='close-package'){$('package-dialog').close();return true;}
    if(action==='package-workflow'||action==='package-sign'||action==='package-final'){const p=findPackage(selectedPackage);if(p)ctx.workflowOpen(p.members[0].id);return true;}

    if(action==='book-open-record'){if($('package-dialog').open)$('package-dialog').close();openDetail(button.dataset.id);return true;}
    return false;
  }
  const dailyUI=window.createDailyUI({...ctx,allPackages,openPackage,packageReview:currentReview});
  const hash=location.hash;
  if(hash.includes('releases')||hash==='#versions')setWorkspace('versions');
  else if(hash==='#reports'||hash==='#source'||hash==='#review'||hash==='#today'||hash==='#settings'||hash==='#demand')setWorkspace(hash.slice(1));
  return {refresh,showWorkspace:setWorkspace,refreshOpenPackage:id=>{if($('package-dialog').open){const r=getRecords().find(x=>x.id===id);if(r){if(!r.version){$('package-dialog').close();return;}selectedPackage=r.version;}drawPackage();}},handleClick,recordSourceMarkup,openPackage,recordDailyMarkup:dailyUI.recordMarkup,recordStageMarkup:dailyUI.recordStageMarkup,recordQuickProgressMarkup:dailyUI.quickMarkup,recordProgressMarkup:dailyUI.progressMarkup,clearDailyDrafts:dailyUI.clearDrafts};
};
