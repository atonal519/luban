/* Shared named views and capability-driven configuration panels. Business edits stay outside. */
window.createTableViews=function(opts){
  const {fields,columns,storageKey,escape:e,icon,toast}=opts,M=window.LubanTableViewModel,$=id=>document.getElementById(id);
  const titles={filters:'筛选',groups:'分组',sorts:'排序',columns:'显示字段'};
  let state=structuredClone(opts.initial),section='',draft=null,nameMode='new',configAnchor=null,outsidePress=false;
  try{
    const stored=JSON.parse(localStorage.getItem(storageKey));
    if(stored){
      if(stored.version!==1||!Array.isArray(stored.views)||!stored.views.length||new Set(stored.views.map(v=>v.id)).size!==stored.views.length)throw new Error();
      stored.views.forEach(v=>M.validate(v,fields,columns));
      if(!stored.views.some(v=>v.id===stored.activeId))throw new Error();state=stored;
    }
  }catch{setTimeout(()=>toast('旧视图配置未能读取，已保留原数据并显示默认视图。',true),0);}
  if(!state.views.some(v=>v.id==='rd')){const rd=opts.initial.views.find(v=>v.id==='rd');if(rd)state.views.splice(1,0,structuredClone(rd));}
  const doneView=state.views.find(v=>v.id==='done'&&v.system);if(doneView&&['本月上线','本月完成'].includes(doneView.name))doneView.name='已完成';
  const current=()=>state.views.find(v=>v.id===state.activeId);
  function persist(next){
    try{next.views.forEach(v=>M.validate(v,fields,columns));localStorage.setItem(storageKey,JSON.stringify(next));}
    catch(error){const message=error.message.startsWith('请')||error.message.includes('字段')||error.message.includes('条件')?error.message:'视图设置未能保存，当前输入已保留。';if($('view-config-dialog').open)$('view-config-error').textContent=message;else if($('view-name-dialog').open)$('view-name-error').textContent=message;toast(message,true);return false;}
    state=next;return true;
  }
  function change(patch,{switched=false}={}){
    const next=structuredClone(state),i=next.views.findIndex(v=>v.id===next.activeId);next.views[i]={...next.views[i],...patch};
    if(!persist(next))return false;opts.onChange?.({switched});return true;
  }
  function paint(){
    const active=current();
    $('views').innerHTML=state.views.map(v=>'<button type="button" class="view-tab '+(v.scope==='attention'?'warning':'')+'" role="tab" aria-selected="'+(v.id===active.id)+'" data-action="view" data-view="'+e(v.id)+'"><span>'+e(v.name)+'</span><span class="count">'+opts.count(v)+'</span></button>').join('')+'<button type="button" class="text-button view-new-button" data-action="view-new">'+icon('plus')+'新建视图</button>';
    for(const key of ['filters','groups','sorts']){
      const button=document.querySelector('[data-view-config="'+key+'"]'),n=active[key].length;
      button.innerHTML=icon(key==='filters'?'filter':key==='groups'?'layers':'sort')+titles[key]+(n?'<span class="view-tool-count">'+n+'</span>':'');button.classList.toggle('configured',n>0);
    }
    document.querySelectorAll('.table-view-tools [data-view-config]').forEach(button=>{button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','view-config-dialog');button.setAttribute('aria-expanded',String($('view-config-dialog').open&&button===configAnchor));});
    $('group-actions').hidden=!active.groups.length;
    $('view-save-status').textContent='视图已保存';
    const scope={all:'全研发',rd:'生产前 FE · 当前进展与风险',mine:'我负责',attention:'需关注',done:'已完成'}[active.scope];
    $('view-scope-label').textContent=scope;
    $('view-options-menu').innerHTML='<button type="button" data-action="view-duplicate">复制当前视图</button>'+(active.system?'<button type="button" data-action="view-reset">恢复此视图默认设置</button>':'<button type="button" data-action="view-rename">重命名视图</button><button type="button" data-action="view-delete">删除视图</button>');
    const summary=$('view-filter-summary');summary.innerHTML=active.filters.map(r=>'<button class="view-filter-chip" type="button" data-action="view-config" data-view-config="filters">'+e(fields.find(f=>f.id===r.field)?.label)+' '+e(M.operators[r.op])+' '+e(r.value||'未填写')+'</button>').join('');summary.hidden=!active.filters.length;
  }
  function fieldOptions(selected,kind,index){
    const available=fields.filter(f=>kind==='filters'?f.filterable:kind==='groups'?f.groupable:true);
    const used=kind==='groups'?draft.groups.filter((_,i)=>i!==index).map(r=>r.field):[];
    return [...new Set(available.map(f=>f.section))].map(label=>'<optgroup label="'+e(label||'字段')+'">'+available.filter(f=>f.section===label).map(f=>'<option value="'+e(f.id)+'" '+(selected===f.id?'selected':'')+' '+(used.includes(f.id)?'disabled':'')+'>'+e(f.label)+'</option>').join('')+'</optgroup>').join('');
  }
  function readDraft(){
    if(!draft)return;
    if(section==='columns')draft.columns=[...$('view-config-body').querySelectorAll('[data-column-id]:checked')].map(el=>el.dataset.columnId);
    else draft[section]=[...$('view-config-body').querySelectorAll('.view-rule')].map(row=>section==='filters'?{field:row.querySelector('[data-rule-field]').value,op:row.querySelector('[data-rule-op]').value,value:row.querySelector('[data-rule-value]').value}:{field:row.querySelector('[data-rule-field]').value,direction:row.querySelector('[data-rule-direction]').value});
  }
  function paintDialog(){
    $('view-config-error').textContent='';
    if(section==='columns'){
      const ids=[...draft.columns,...columns.map(c=>c.id).filter(id=>!draft.columns.includes(id))];
      $('view-config-body').innerHTML='<p class="section-description">勾选要展示的字段；用上下按钮调整顺序。FE 名称保留在首列。</p><div class="view-column-list">'+ids.map((id,i)=>{const c=columns.find(c=>c.id===id);return '<div class="view-column-row" data-column="'+id+'"><label><input type="checkbox" data-column-id="'+id+'" '+(draft.columns.includes(id)?'checked':'')+' '+(c.fixed?'disabled':'')+'>'+e(c.name)+(c.fixed?'<span class="muted">必需</span>':'')+'</label><div><button type="button" class="btn icon-button" data-action="view-column-up" data-index="'+i+'" aria-label="上移'+e(c.name)+'" '+(i<=1?'disabled':'')+'>↑</button><button type="button" class="btn icon-button" data-action="view-column-down" data-index="'+i+'" aria-label="下移'+e(c.name)+'" '+(!i||i===ids.length-1?'disabled':'')+'>↓</button></div></div>';}).join('')+'</div>';
      return;
    }
    const hint=section==='filters'?'条件需同时满足；等于留空可查未填写。':section==='groups'?'从上到下依次分组，可调整层级顺序。':'按顺序依次排序，空值在最后。';
    $('view-config-body').innerHTML='<p class="section-description">'+hint+'</p><div class="view-rules">'+draft[section].map((r,i)=>'<div class="view-rule" data-index="'+i+'"><span class="view-rule-number">'+(section==='filters'?'条件 ':section==='groups'?'第 ':'排序 ')+(i+1)+(section==='groups'?' 层':'')+'</span><select data-rule-field aria-label="'+titles[section]+'字段 '+(i+1)+'">'+fieldOptions(r.field,section,i)+'</select>'+(section==='filters'?'<select data-rule-op aria-label="筛选方式 '+(i+1)+'">'+Object.entries(M.operators).map(([v,l])=>'<option value="'+v+'" '+(r.op===v?'selected':'')+'>'+l+'</option>').join('')+'</select><textarea data-rule-value rows="1" maxlength="20000" aria-label="筛选值 '+(i+1)+'" placeholder="'+(fields.find(f=>f.id===r.field)?.type==='date'?'如 2026-10-21 或 2026-10':'输入值；等于可留空')+'">'+e(r.value||'')+'</textarea>':'<select data-rule-direction aria-label="顺序 '+(i+1)+'"><option value="asc" '+(r.direction!=='desc'?'selected':'')+'>正序</option><option value="desc" '+(r.direction==='desc'?'selected':'')+'>倒序</option></select>')+'<div class="view-rule-actions">'+(section!=='filters'?'<button type="button" class="btn icon-button" data-action="view-move-up" data-index="'+i+'" aria-label="上移第'+(i+1)+'项" '+(!i?'disabled':'')+'>↑</button><button type="button" class="btn icon-button" data-action="view-move-down" data-index="'+i+'" aria-label="下移第'+(i+1)+'项" '+(i===draft[section].length-1?'disabled':'')+'>↓</button>':'')+'<button type="button" class="btn icon-button" data-action="view-remove-rule" data-index="'+i+'" aria-label="移除第'+(i+1)+'项">'+icon('close')+'</button></div></div>').join('')+'</div><div class="view-rule-add"><button type="button" class="btn" data-action="view-add-rule">'+icon('plus')+'添加'+(section==='groups'?'分组层':section==='sorts'?'排序':'条件')+'</button><button type="button" class="text-button" data-action="view-clear-rules">清空'+titles[section]+'</button></div>';
  }
  function positionPanel(){
    const panel=$('view-config-dialog');if(!panel.open||!configAnchor)return;
    const v=window.visualViewport,bounds={left:(v?.offsetLeft||0)+8,top:(v?.offsetTop||0)+8,right:(v?.offsetLeft||0)+(v?.width||innerWidth)-8,bottom:(v?.offsetTop||0)+(v?.height||innerHeight)-8};
    const anchor=configAnchor.getBoundingClientRect(),below=bounds.bottom-anchor.bottom-6,above=anchor.top-bounds.top-6;
    const bottomSide=below>=200||below>=above,space=Math.max(below,above),offscreen=anchor.bottom<bounds.top||anchor.top>bounds.bottom;
    panel.style.maxHeight=Math.min(560,Math.max(160,offscreen?bounds.bottom-bounds.top:(bottomSide?below:space)),bounds.bottom-bounds.top)+'px';
    const rect=panel.getBoundingClientRect();
    panel.style.left=Math.max(bounds.left,Math.min(anchor.left,bounds.right-rect.width))+'px';
    panel.style.top=Math.max(bounds.top,Math.min(offscreen?bounds.top:bottomSide?anchor.bottom+6:anchor.top-6-rect.height,bounds.bottom-rect.height))+'px';
  }
  function openConfig(kind){
    section=kind;draft=structuredClone(current());
    configAnchor=document.querySelector('.table-view-tools [data-view-config="'+kind+'"]');
    const panel=$('view-config-dialog');panel.dataset.panelKind=kind;
    panel.innerHTML='<div class="modal-heading"><h2 id="view-config-title">'+titles[kind]+'设置</h2><button type="button" class="btn icon-button" data-action="view-cancel" aria-label="关闭'+titles[kind]+'设置">'+icon('close')+'</button></div><div class="modal-body" id="view-config-body"></div><p class="field-error view-panel-error" id="view-config-error" role="alert"></p><div class="modal-footer"><button type="button" class="btn" data-action="view-cancel">取消</button><button type="button" class="btn primary" data-action="view-apply">应用并保存</button></div>';
    paintDialog();panel.showModal();positionPanel();configAnchor?.setAttribute('aria-expanded','true');
  }
  function openName(mode){
    nameMode=mode;const deleting=mode==='delete',rename=mode==='rename';
    $('view-name-dialog').innerHTML='<div class="modal-heading"><h2 id="view-name-title">'+(deleting?'删除视图':rename?'重命名视图':'保存为新视图')+'</h2><button type="button" class="btn icon-button" data-action="view-close-name" aria-label="关闭视图命名">'+icon('close')+'</button></div><div class="modal-body">'+(deleting?'<p>删除“'+e(current().name)+'”的展示配置，FE 数据保留。</p>':'<label class="form-field">视图名称<input id="view-name" maxlength="60" value="'+e(rename?current().name:mode==='duplicate'?current().name+' 副本':'')+'" placeholder="例如：规划包推进"></label>')+'<p class="field-error" id="view-name-error" role="alert"></p></div><div class="modal-footer"><button type="button" class="btn" data-action="view-close-name">取消</button><button type="button" class="btn '+(deleting?'danger':'primary')+'" data-action="view-save-name">'+(deleting?'删除视图':'保存视图')+'</button></div>';
    $('view-name-dialog').showModal();$('view-name')?.focus();
  }
  function saveName(){
    const next=structuredClone(state),active=next.views.find(v=>v.id===next.activeId),name=$('view-name')?.value.trim();
    if(nameMode==='delete'){if(active.system)return;next.views=next.views.filter(v=>v.id!==active.id);next.activeId=next.views[0].id;}
    else{
      if(!name||name.length>60){$('view-name-error').textContent='请填写视图名称，最多 60 字。';return;}
      if(next.views.some(v=>v.name===name&&(nameMode!=='rename'||v.id!==active.id))){$('view-name-error').textContent='已有同名视图，请换一个名称。';return;}
      if(nameMode==='rename'){if(active.system)return;active.name=name;}
      else{const id='view-'+crypto.randomUUID();next.views.push({...structuredClone(active),id,name,system:false,closed:[]});next.activeId=id;}
    }
    if(!persist(next))return;$('view-name-dialog').close();opts.onChange?.({switched:true});toast(nameMode==='delete'?'视图配置已删除，FE 数据保留':'视图已保存');
  }
  function handleClick(button){
    if(button.dataset.viewConfig){openConfig(button.dataset.viewConfig);return true;}
    const action=button.dataset.action;
    if(action==='view'){const next=structuredClone(state);if(!next.views.some(v=>v.id===button.dataset.view))return true;next.activeId=button.dataset.view;if(persist(next))opts.onChange?.({switched:true});return true;}
    if(action==='view-options'){$('view-options-menu').hidden=!$('view-options-menu').hidden;return true;}
    if(['view-new','view-duplicate','view-rename','view-delete'].includes(action)){$('view-options-menu').hidden=true;openName(action.slice(5));return true;}
    if(action==='view-reset'){const baseline=opts.initial.views.find(v=>v.id===current().id);if(baseline)change(structuredClone(baseline));$('view-options-menu').hidden=true;return true;}
    if(action==='view-save-name'){saveName();return true;}
    if(action==='view-close-name'){$('view-name-dialog').close();return true;}
    if(action==='view-cancel'){$('view-config-dialog').close();draft=null;return true;}
    if(action==='view-apply'){
      readDraft();try{M.validate(draft,fields,columns);}catch(error){$('view-config-error').textContent=error.message;return true;}
      if(change({[section]:draft[section],...(section==='groups'?{closed:[]}: {})})){$('view-config-dialog').close();draft=null;toast('当前视图已保存');}return true;
    }
    if(action==='view-add-rule'){
      readDraft();const f=fields.find(f=>section==='filters'?f.filterable:section==='groups'?f.groupable&&!draft.groups.some(r=>r.field===f.id):true);
      if(!f){$('view-config-error').textContent='没有更多可用分组字段。';return true;}
      draft[section].push(section==='filters'?{field:f.id,op:'eq',value:''}:{field:f.id,direction:'asc'});paintDialog();return true;
    }
    if(action==='view-clear-rules'){draft[section]=[];paintDialog();return true;}
    if(['view-remove-rule','view-move-up','view-move-down'].includes(action)){
      readDraft();const i=Number(button.dataset.index),list=draft[section];if(action==='view-remove-rule')list.splice(i,1);else{const to=i+(action==='view-move-up'?-1:1);if(to>=0&&to<list.length)[list[i],list[to]]=[list[to],list[i]];}paintDialog();return true;
    }
    if(action==='view-column-up'||action==='view-column-down'){
      const ids=[...$('view-config-body').querySelectorAll('[data-column-id]')].map(el=>el.dataset.columnId),checked=new Set([...$('view-config-body').querySelectorAll('[data-column-id]:checked')].map(el=>el.dataset.columnId));
      const i=Number(button.dataset.index),to=i+(action==='view-column-up'?-1:1);if(i>0&&to>0&&to<ids.length)[ids[i],ids[to]]=[ids[to],ids[i]];
      const body=$('view-config-body');const rows=new Map([...body.querySelectorAll('.view-column-row')].map(el=>[el.dataset.column,el]));const list=body.querySelector('.view-column-list');ids.forEach((id,index)=>{const row=rows.get(id);row.querySelectorAll('[data-index]').forEach(b=>{b.dataset.index=index;b.disabled=b.dataset.action==='view-column-up'?index<=1:!index||index===ids.length-1;});list.appendChild(row);});draft.columns=ids.filter(id=>checked.has(id));return true;
    }
    return false;
  }
  document.addEventListener('change',event=>{
    if(event.target.matches('#view-config-dialog [data-rule-field]')){readDraft();if(section==='filters')draft.filters[Number(event.target.closest('.view-rule').dataset.index)].value='';paintDialog();}
  });
  document.addEventListener('click',event=>{if(!event.target.closest('.view-options-control'))$('view-options-menu').hidden=true;});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.id==='view-name'){event.preventDefault();saveName();}});
  const configPanel=$('view-config-dialog');
  const outside=event=>{const r=configPanel.getBoundingClientRect();return event.target===configPanel&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
  configPanel.addEventListener('pointerdown',event=>{outsidePress=outside(event);});
  configPanel.addEventListener('click',event=>{if(outsidePress&&outside(event))configPanel.close();outsidePress=false;});
  configPanel.addEventListener('close',()=>{draft=null;outsidePress=false;configAnchor?.setAttribute('aria-expanded','false');configAnchor?.focus({preventScroll:true});});
  new ResizeObserver(positionPanel).observe(configPanel);
  window.addEventListener('resize',positionPanel);
  window.visualViewport?.addEventListener('resize',positionPanel);
  window.addEventListener('scroll',event=>{if(!configPanel.contains(event.target))positionPanel();},true);
  function selectAll(){const next=structuredClone(state);next.activeId='all';const v=next.views.find(v=>v.id==='all');v.filters=[];v.month='all';if(persist(next))opts.onChange?.({switched:true});}
  return {current,paint,handleClick,change,selectAll,fields,model:M};
};
