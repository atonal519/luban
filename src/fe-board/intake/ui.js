/* One work identity, compact creation, monthly review and a shared right-hand drawer. */
window.createIntakeUI=function(ctx){
  const M=window.LubanIntake,W=window.LubanRatWorkspace,R=window.LubanRat,e=ctx.esc,DD=window.LubanCheckDropdown;
  const root=document.getElementById('aux-workspace'),quick=document.getElementById('intake-dialog'),drawer=document.getElementById('intake-detail'),discard=document.getElementById('intake-discard-dialog');
  let tab='demands',module='',source='',search='',month=ctx.today.slice(0,7),resultFilter='',formState=null,dirty=false,pendingLeave=null,preparing=false,lastTrigger=null;
  const fields=[['priority','优先级',68],['modules','模块',90],['source','需求来源',110],['people','人员',120],['effort','计划人天',76],['testDate','提测日期',108],['launchDate','上线日期',108],['review','审核',104]];
  fields.push(['classificationTags','分类标签',140],['triggerScenes','触发场景',140]);
  const tagFilters={classificationTags:[],triggerScenes:[]};
  let shown=new Set(fields.filter(([key])=>!M.tagFields.includes(key)).map(([key])=>key));const columnsKey='luban-'+window.LUBAN_DATASET.id+'-rat-columns-v4';
  try{const saved=JSON.parse(localStorage.getItem(columnsKey));if(Array.isArray(saved))shown=new Set(saved.filter(k=>fields.some(([id])=>id===k)));}catch{}
  const state=()=>ctx.getState(),actor=()=>ctx.getActor(),admin=()=>actor().kind==='creator';
  const canDemand=d=>admin()||d?.createdBy===actor().id||actor().kind==='pm'&&d?.modules.includes(actor().module);
  const canEntry=item=>canDemand(item.demand)||actor().kind==='pm'&&item.tasks.every(t=>t.module===actor().module||t.createdBy===actor().id);
  const dById=id=>state().demands.find(d=>d.id===id);
  const entry=(id,m=month)=>W.entries(state(),m).find(x=>x.id===id);
  const options=(values,current,empty='')=>(empty?'<option value="">'+e(empty)+'</option>':'')+values.map(v=>{const [value,label]=Array.isArray(v)?v:[v,v];return '<option value="'+e(value)+'" '+(value===current?'selected':'')+'>'+e(label)+'</option>';}).join('');
  const button=(label,action,primary=false,attrs='')=>'<button type="button" class="btn '+(primary?'primary':'')+'" data-intake-action="'+action+'" '+attrs+'>'+e(label)+'</button>';
  const chips=ms=>'<div class="module-chips">'+ms.filter(Boolean).map(m=>'<span class="module-chip">'+e(m)+'</span>').join('')+'</div>';
  const time=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'';
  const input=(name,label,value='',placeholder='',required=false)=>'<label class="form-field"><span class="field-heading">'+e(label)+(required?'<span class="required">必填</span>':'')+'</span><input name="'+name+'" value="'+e(value??'')+'" placeholder="'+e(placeholder)+'" '+(required?'required':'')+' '+(name==='content'?'maxlength="500"':'')+'></label>';
  const months=()=>{const year=Number(ctx.today.slice(0,4)),list=[];for(let y=year-1;y<=year+2;y++)for(let m=1;m<=12;m++)list.push(y+'-'+String(m).padStart(2,'0'));return [...new Set([...list,...state().tasks.map(t=>t.month)])].sort();};
  const moduleField=(id,ms)=>'<div class="form-field"><span>需求模块</span>'+DD.render({id,label:'选择模块（选填）',options:ctx.modules.map(m=>[m,m]),selected:ms,name:'modules',summary:true})+'</div>';
  const sourceField=d=>'<label class="form-field">需求来源<select name="source">'+options(M.categories,M.demandSource(d||{}),'未选择')+'</select></label>';
  const materials=d=>'<label class="form-field">数据支撑<textarea name="materials" rows="2" placeholder="链接或补充材料（选填）">'+e(d?.materials||'')+'</textarea></label>';
  const tagNames={classificationTags:'分类标签',triggerScenes:'触发场景'};
  const tagField=(prefix,key,d)=>'<div class="form-field intake-tag-field"><span>'+tagNames[key]+'</span>'+DD.render({id:prefix+'-'+key,label:'选择或新增',createLabel:tagNames[key],options:M.tagChoices(state(),key).map(value=>[value,value]),selected:M.tagValues(d?.[key]),name:key,summary:true,allowCreate:true})+'</div>';
  const tagFieldsMarkup=(prefix,d)=>'<div class="form-grid intake-tag-fields">'+M.tagFields.map(key=>tagField(prefix,key,d)).join('')+'</div>';
  const tagFilter=key=>'<div class="intake-tag-filter"><span>'+tagNames[key]+'</span>'+DD.render({id:'filter-'+key,label:'全部'+tagNames[key],options:M.tagChoices(state(),key).map(value=>[value,value]),selected:tagFilters[key],name:'filter-'+key,summary:true})+'</div>';
  let fieldState=null,fieldCache=new Map();
  const typedFields=(d,m)=>{if(fieldState!==state()){fieldState=state();fieldCache=new Map();}const key=d.id+'@'+(m||'');if(!fieldCache.has(key))fieldCache.set(key,W.fieldsFor(state(),d.id,m));return fieldCache.get(key);};
  const picker=()=>DD.render({id:'rat-field-picker',label:'显示字段',options:fields.map(([id,label])=>[id,label]),selected:[...shown],name:'rat-visible-field'});
  const resourceUI=window.createRatResourceUI({...ctx,root,render,openTask:openTaskDrawer,onMonthChange:value=>{month=value;}});

  function filters(){
    return '<div class="intake-toolbar"><label class="search"><span>'+ctx.icon('search')+'</span><input id="intake-search" value="'+e(search)+'" placeholder="搜索需求内容或标签" aria-label="搜索需求"></label><label>包含模块<select id="intake-module">'+options(ctx.modules,module,'全部模块')+'</select></label>'+(tab==='plans'?'<label>计划月份<select id="intake-month">'+options(months(),month)+'</select></label><label>审核结果<select id="intake-status">'+options([['empty','未选择'],['passed','通过'],['rejected','不通过']],resultFilter,'全部结果')+'</select></label>':'<label>需求来源<select id="intake-source">'+options(M.categories,source,'全部来源')+'</select></label>')+M.tagFields.map(tagFilter).join('')+(tab==='plans'?'<div class="intake-toolbar-tools">'+picker()+'</div>':'')+'</div>';
  }
  function render(){
    if(ctx.ratSource&&!preparing&&R.needsImport(state(),ctx.ratSource)){
      preparing=true;queueMicrotask(()=>{const r=ctx.commit({type:'rat-import'});preparing=false;if(!r.ok)ctx.toast(r.message||'未能载入RAT',true);});
    }else if(tab==='plans'&&!preparing&&W.eligible(state(),ctx.getRecords(),month).length){
      preparing=true;queueMicrotask(()=>{const r=ctx.commit({type:'rat-prepare-month',month});preparing=false;if(!r.ok)ctx.toast(r.message||'未能载入本月计划',true);});
    }
    const ds=M.filterDemands(state(),{module:tab==='demands'?module:'',source:tab==='demands'?source:'',search,...tagFilters});
    if(tab==='resources')resourceUI.setMonth(month);
    root.innerHTML='<div class="page-heading"><div><div class="page-title"><h1>需求池</h1><span class="total-label">'+state().demands.length+' 条需求</span></div></div>'+button(tab==='demands'?'新增需求':'新增 RAT 工作',tab==='demands'?'new-demand':'new-rat',true)+'</div><div class="intake-tabs" role="tablist" aria-label="需求池视图">'+['demands','plans','resources'].map(key=>'<button type="button" role="tab" aria-selected="'+(tab===key)+'" class="'+(tab===key?'active':'')+'" data-intake-action="tab" data-tab="'+key+'">'+({demands:'需求列表',plans:'月度计划（RAT）',resources:'人力资源池'}[key])+'</button>').join('')+'</div>'+(tab==='resources'?resourceUI.render():filters()+(tab==='demands'?demandTable(ds):planTable(ds)));
    window.LubanSelect.enhance(root);DD.fit(root);
  }
  function demandTable(ds){
    if(!ds.length)return '<div class="intake-empty">'+(state().demands.length?'当前筛选下没有需求':'暂无需求')+'</div>';
    return '<div class="intake-table-wrap"><table class="intake-table intake-demands"><colgroup><col><col style="width:95px"><col style="width:140px"><col style="width:100px"><col style="width:140px"><col style="width:160px"><col style="width:100px"><col style="width:120px"></colgroup><thead><tr><th>需求内容</th><th>需求模块</th><th>分类标签</th><th>需求来源</th><th>触发场景</th><th>数据支撑</th><th>录入时间</th><th></th></tr></thead><tbody>'+ds.map(d=>'<tr data-demand="'+e(d.id)+'"><td><button type="button" class="fe-link" data-intake-action="open-demand" data-id="'+e(d.id)+'">'+e(M.title(d))+'</button></td><td>'+chips(d.modules)+'</td><td>'+chips(M.tagValues(d.classificationTags))+'</td><td>'+e(M.demandSource(d)||'未选择')+'</td><td>'+chips(M.tagValues(d.triggerScenes))+'</td><td><span class="intake-material-summary">'+e(d.materials||'—')+'</span></td><td>'+e(time(d.createdAt))+'</td><td>'+button('加入月度计划','add-to-rat',false,'data-id="'+e(d.id)+'"')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  const reviewValue=item=>item.passed?'passed':item.tasks.every(t=>t.review?.result==='rejected')?'rejected':'';
  function reviewCheckbox(item,placement='list'){
    const value=reviewValue(item);
    return '<div class="intake-review-field review-'+(value||'empty')+'"><select data-native-select class="intake-review-select" data-review-demand="'+e(item.id)+'" data-review-month="'+e(item.month)+'" name="review-'+placement+'-'+e(item.id)+'" aria-label="'+e(M.title(item.demand))+'审核" '+(admin()?'':'disabled')+'>'+options([['passed','通过'],['rejected','不通过']],value,'未选择')+'</select></div>';
  }
  function planTable(ds){
    const ids=new Set(ds.map(d=>d.id));const items=W.entries(state(),month).filter(item=>ids.has(item.id)&&(!module||item.modules.includes(module))&&(!resultFilter||(resultFilter==='empty'?!reviewValue(item):reviewValue(item)===resultFilter)));
    const visible=fields.filter(([key])=>shown.has(key)),width=320+visible.reduce((sum,[,,w])=>sum+w,0);
    if(!items.length)return '<div class="intake-empty">本月暂无工作</div>';
    const value=(item,key)=>{
      if(M.tagFields.includes(key))return chips(M.tagValues(item.demand[key]));
      const data=typedFields(item.demand,item.month);
      if(['priority','testDate','launchDate'].includes(key)){const values=data[key+'Values'];return '<button type="button" class="rat-cell-field" data-intake-action="open-plan" data-id="'+e(item.id)+'" data-focus-field="'+key+'" aria-label="修改'+e(fields.find(([id])=>id===key)?.[1]||key)+'：'+e(M.title(item.demand))+'">'+(values.length?values.map(v=>'<span class="rat-short-value">'+e(v)+'</span>').join(''):'<span class="muted">未填写</span>')+'</button>';}
      return key==='modules'?chips(item.modules):key==='source'?e(M.demandSource(item.demand)||'未选择'):key==='people'?e(item.people.join('、')||'未填写'):key==='effort'?e(item.unknown?(item.days?item.days+' + 待明确':'待明确'):String(item.days)):reviewCheckbox(item);
    };
    return '<div class="intake-table-wrap rat-plan-wrap"><table class="intake-table intake-plans" style="min-width:'+width+'px"><colgroup><col>'+visible.map(([,,w])=>'<col style="width:'+w+'px">').join('')+'</colgroup><thead><tr><th>需求内容</th>'+visible.map(([,label])=>'<th>'+e(label)+'</th>').join('')+'</tr></thead><tbody>'+items.map(item=>'<tr data-plan="'+e(item.id)+'"><td><button type="button" class="fe-link" data-intake-action="open-plan" data-id="'+e(item.id)+'">'+e(M.title(item.demand))+'</button></td>'+visible.map(([key])=>'<td>'+value(item,key)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function planField(name,label,values,type='text'){
    const value=values.length===1?values[0]:'',conflict=values.length>1;
    const control=name==='priority'?'<select name="priority" data-structured-field="priority">'+options(['T0','T0.5','T1','T2'],value,conflict?'未统一':'未填写')+'</select>':'<input type="'+type+'" name="'+name+'" data-structured-field="'+name+'" value="'+e(value)+'">';
    return '<label class="form-field"><span>'+e(label)+'</span>'+control+(conflict?'<small class="intake-field-conflict" data-conflict-for="'+name+'">现有值：'+e(values.join('、'))+' <button type="button" class="text-button" data-intake-action="clear-plan-field" data-field="'+name+'">清空</button></small>':'')+'</label>';
  }
  function evidenceValue(d,item,data){
    const value=structuredClone(data.sourceDetails),overrides=item?d.monthlyFields?.[item.month]:d.structuredFields;
    if(!Object.hasOwn(overrides||{},'sourceDetails')&&d.materials&&!value.text.includes(d.materials)){
      value.text=[value.text,d.materials].filter(Boolean).join('\n\n');value.html=window.LubanRichText.fromText(value.text);
    }
    return value;
  }
  function markRichChange(payload){
    if(!formState)return;dirty=true;
    if(payload.editor?.closest('[data-source-evidence]'))formState.evidenceChanged=true;
    else if(payload.id==='intake-mokr')formState.patchKeys.add('mokr');
    else if(payload.id==='intake-story')formState.patchKeys.add('story');
  }
  function assignmentFields(item){
    if(!item)return '<div class="form-grid">'+input('owner','人员分配','','选填')+input('effort','计划人天','','选填')+'</div>';
    let n=0;
    return '<div class="intake-assignments">'+item.tasks.map(t=>(t.allocations?.length?t.allocations:[t]).map((a,index)=>{const id=n++;return '<div class="intake-assignment" data-assignment-task="'+e(t.id)+'" '+(t.allocations?'data-assignment-index="'+index+'"':'')+'>'+(item.allocations.length>1?'<div class="intake-assignment-module">'+chips(a.modules||t.modules||[t.module])+'</div>':'')+'<div class="form-grid">'+input('owner-'+id,'人员分配',a.owner||'','选填')+input('effort-'+id,'计划人天',a.effort??'','选填')+'</div></div>';}).join('')).join('')+'</div>';
  }
  function enhanceForm(surface){window.LubanSelect.enhance(surface);window.LubanRichEditor.bind(surface,{onChange:markRichChange,onSave:()=>saveForm()});window.LubanSourceEvidence.bind(surface,{onChange:()=>{if(formState){dirty=true;formState.evidenceChanged=true;}},onSave:()=>saveForm(),onError:payload=>{if(formState?.surface===surface)showError(payload.message);}});}
  function openQuick(kind,demandId){
    if(kind==='plan'&&demandId&&entry(demandId,month))return openDrawer('plan',demandId,month);
    return guard(()=>{
      const d=demandId?dById(demandId):null;formState={surface:quick,kind,demandId:d?.id||'',month:kind==='plan'?month:'',revision:d?.revision,patchKeys:new Set(),evidenceChanged:false};dirty=false;lastTrigger=document.activeElement;
      quick.className='modal intake-modal intake-quick';
      quick.innerHTML='<div class="modal-heading"><h2 id="intake-title">'+(kind==='plan'?(d?'加入月度 RAT':'新增 RAT 工作'):'新增需求')+(kind==='plan'&&!d?'<small class="intake-quick-context">'+e(month)+'</small>':'')+'</h2><button type="button" class="btn icon-button" data-intake-action="close" aria-label="关闭">'+ctx.icon('close')+'</button></div><form id="intake-form" novalidate><div class="modal-body">'+input('content','需求内容',d?.content||'','用一句话描述这项工作',true)+'<div class="form-grid">'+moduleField('quick-modules',d?.modules||[])+sourceField(d)+'</div>'+tagFieldsMarkup('quick',d)+(kind==='plan'?(d?'<div class="intake-quick-month"><label class="form-field">计划月份<select name="month">'+options(months(),month)+'</select></label></div>':'<input type="hidden" name="month" value="'+e(month)+'">')+assignmentFields(null)+window.LubanRichEditor.markup({id:'quick-rat-details',label:'内容详情',html:d?.detailsHtml||'',compact:true}):materials(d))+'</div><div class="modal-footer"><p class="field-error" role="alert" tabindex="-1"></p>'+button('取消','close')+'<button class="btn primary" type="submit">'+(kind==='plan'?'加入 RAT':'添加需求')+'</button></div></form>';
      enhanceForm(quick);if(!quick.open)quick.showModal();quick.querySelector('[name="content"]').focus();
    });
  }
  function fitNotes(){
    if(drawer.dataset.intakeLayout!=='continuous')return;
    const field=drawer.querySelector('[name="notesText"]');if(!field)return;
    field.style.height='auto';field.style.height=(field.scrollHeight+field.offsetHeight-field.clientHeight)+'px';
  }
  function openDrawer(kind,id,m=month,focusField=''){
    return guard(()=>{
      const d=dById(id),item=kind==='plan'?entry(id,m):null;if(!d||kind==='plan'&&!item){ctx.toast('该项已不存在，请刷新',true);return;}
      const data=typedFields(d,item?.month),editable=item?canEntry(item):canDemand(d);
      drawer.dataset.intakeLayout='continuous';
      formState={surface:drawer,kind,demandId:id,month:kind==='plan'?m:'',revision:d.revision,taskRevisions:item?Object.fromEntries(item.tasks.map(t=>[t.id,t.revision])):undefined,patchKeys:new Set(),evidenceChanged:false};dirty=false;lastTrigger=document.activeElement;
      const basic=input('content','需求内容',d.content,'用一句话描述这项工作',true)+'<div class="form-grid">'+moduleField('detail-modules',item?item.modules:d.modules)+sourceField(d)+'</div>'+tagFieldsMarkup('detail',d)+(item?'<div class="form-grid">'+planField('priority','优先级',data.priorityValues)+planField('topic','专项',data.topicValues)+'</div><div class="form-grid">'+planField('testDate','提测日期',data.testDateValues,'date')+planField('launchDate','上线日期',data.launchDateValues,'date')+'</div>'+assignmentFields(item):'');
      const support=window.LubanSourceEvidence.markup({id:'intake-source-detail',label:'数据支撑',value:evidenceValue(d,item,data),readonly:!editable});
      const goals=window.LubanRichEditor.markup({id:'intake-mokr',label:'MOKR',html:data.mokrHtml,readonly:!editable})+support;
      const work=window.LubanRichEditor.markup({id:'intake-story',label:'Story',html:data.storyHtml,readonly:!editable})+'<label class="form-field">备注<textarea name="notesText" data-structured-field="notesText" rows="3" placeholder="补充备注（选填）">'+e(data.notesText)+'</textarea></label>';
      const sections=item?[['basic','基本信息',basic],['goals','目标与来源',goals],['work','工作内容',work]]:[['basic','基本信息',basic+support]];
      const panels=sections.map(([key,,html])=>'<section id="intake-panel-'+key+'" data-detail-panel="'+key+'">'+html+'</section>').join('');
      drawer.innerHTML='<div class="drawer-top"><span>'+(kind==='plan'?'月度 RAT 详情':'需求详情')+'</span><button type="button" class="btn icon-button" data-intake-action="close" aria-label="关闭详情">'+ctx.icon('close')+'</button></div><div class="detail-heading"><h2 id="intake-detail-title">'+e(M.title(d))+'</h2>'+(item?'<div class="detail-meta">'+e(m)+'</div>':'')+'</div><form id="intake-detail-form" class="drawer-scroll" novalidate><fieldset class="details-fields" '+(editable?'':'disabled')+'>'+panels+'</fieldset></form><div class="detail-footer"><span class="footer-note" id="intake-detail-status">Enter 换行 · Shift+Enter 保存</span><div class="intake-detail-actions">'+(item?'<div class="intake-drawer-approval">'+reviewCheckbox(item,'drawer')+'</div>':'')+(editable?button('保存修改','save-form',true):'')+'</div></div><p class="field-error intake-drawer-error" role="alert" tabindex="-1"></p>';
      enhanceForm(drawer);if(!drawer.open)drawer.showModal();fitNotes();if(focusField){const field=drawer.querySelector('[data-structured-field="'+focusField+'"]');const target=field?.hidden?field.parentElement.querySelector('[role="combobox"]'):field;target?.focus();}
    });
  }
  function openTaskDrawer(taskId){const t=state().tasks.find(t=>t.id===taskId);if(t)openDrawer('plan',t.demandId,t.month);}
  function formValues(){
    const {surface,kind}=formState;DD.flush(surface);
    const form=surface.querySelector('form'),data=new FormData(form),d=formState.demandId?dById(formState.demandId):null;
    const action={type:'rat-workspace-save',demandId:formState.demandId||undefined,revision:formState.revision,content:data.get('content')||'',modules:data.getAll('modules'),source:data.get('source')||'',materials:data.has('materials')?data.get('materials'):d?.materials||'',...Object.fromEntries(M.tagFields.map(key=>[key,data.getAll(key)]))};
    if(kind==='plan'){
      action.month=data.get('month')||formState.month;action.taskRevisions=formState.taskRevisions;
      if(surface===quick){action.owner=data.get('owner')||'';action.effort=data.get('effort')||'';}
      else{
        const item=entry(formState.demandId,formState.month),group=new Map();
        surface.querySelectorAll('[data-assignment-task]').forEach(row=>{const id=row.dataset.assignmentTask,t=item.tasks.find(t=>t.id===id);let assignment=group.get(id);if(!assignment){assignment={id,...(t.allocations?{allocations:structuredClone(t.allocations)}:{})};group.set(id,assignment);}
          const fields=row.querySelectorAll('input');const values={owner:fields[0].value,effort:fields[1].value};if(t.allocations)Object.assign(assignment.allocations[Number(row.dataset.assignmentIndex)],values);else Object.assign(assignment,values);
        });action.assignments=[...group.values()];
      }
    }
    if(surface===quick){const rich=surface.querySelector('[data-rich-editor]');if(rich){const value=window.LubanRichEditor.read(rich);action.structuredPatch={storyHtml:value.html,storyText:value.text};}}
    if(surface===drawer){
      const patch={};for(const key of formState.patchKeys){
        if(key==='mokr'||key==='story'){const value=window.LubanRichEditor.read(surface.querySelector('[data-rich-editor="intake-'+key+'"]'));patch[key+'Html']=value.html;patch[key+'Text']=value.text;}
        else{const field=surface.querySelector('[data-structured-field="'+key+'"]');patch[key]=field.value;}
      }
      if(formState.evidenceChanged){patch.sourceDetails=window.LubanSourceEvidence.read(surface.querySelector('[data-source-evidence]'));if(!formState.month)action.materials=patch.sourceDetails.text;}
      if(Object.keys(patch).length)action.structuredPatch=patch;
    }
    return action;
  }
  function showError(message){const field=formState.surface===drawer?drawer.querySelector('.intake-drawer-error'):quick.querySelector('[role="alert"]');field.textContent=message;field.focus({preventScroll:true});field.scrollIntoView({block:'nearest'});}
  async function saveForm(){
    if(!formState||formState.saving)return false;const active=formState;active.saving=true;
    const saveButton=active.surface.querySelector('[data-intake-action="save-form"],button[type="submit"]');if(saveButton)saveButton.disabled=true;
    try{
      await window.LubanSourceEvidence.flush(active.surface);
      if(formState!==active||!active.surface.open)return false;
      const action=formValues();if(!String(action.content).trim()){showError('请填写需求内容');active.surface.querySelector('[name="content"]').focus();return false;}
      if(active.surface===quick&&action.month&&action.demandId&&entry(action.demandId,action.month)){showError('该月已有这项计划，请调整月份；本次填写内容仍保留。');return false;}
      const r=ctx.commit(action);if(!r.ok){showError(r.message||'未能保存，当前输入已保留');return false;}
      dirty=false;const d=action.demandId?dById(action.demandId):state().demands.at(-1);
      if(active.surface===quick){window.LubanSourceEvidence.dispose(quick);quick.close();if(action.month){tab='plans';month=action.month;}formState=null;render();ctx.toast('已添加');}
      else{active.revision=d.revision;const item=active.kind==='plan'?entry(d.id,active.month):null;active.taskRevisions=item?Object.fromEntries(item.tasks.map(t=>[t.id,t.revision])):undefined;active.patchKeys.clear();active.evidenceChanged=false;drawer.querySelector('#intake-detail-title').textContent=M.title(d);drawer.querySelector('.intake-drawer-error').textContent='';drawer.querySelector('#intake-detail-status').textContent='已保存';for(const key of Object.keys(action.structuredPatch||{}))drawer.querySelector('[data-conflict-for="'+key+'"]')?.remove();ctx.toast('已保存');}
      return true;
    }catch(error){if(formState===active)showError(error.message||'未能保存，当前输入已保留');return false;}
    finally{active.saving=false;if(saveButton?.isConnected)saveButton.disabled=false;}
  }
  function guard(action){if(dirty&&formState?.surface.open){pendingLeave=action;discard.showModal();return false;}window.LubanSourceEvidence.dispose(quick);window.LubanSourceEvidence.dispose(drawer);quick.close();drawer.close();formState=null;action();return true;}
  function close(){guard(()=>{dirty=false;formState=null;lastTrigger?.focus?.();});}
  function syncReview(item){for(const scope of [root,drawer])scope.querySelectorAll('[data-review-demand]').forEach(input=>{if(input.dataset.reviewDemand===item.id&&input.dataset.reviewMonth===item.month){input.value=reviewValue(item);const field=input.closest('.intake-review-field');field.className='intake-review-field review-'+(input.value||'empty');} });window.LubanSelect.enhance(root);window.LubanSelect.enhance(drawer);}
  async function review(el){
    const item=entry(el.dataset.reviewDemand,el.dataset.reviewMonth);if(!item)return;
    const result=el.value||null;const apply=()=>{const fresh=entry(item.id,item.month),r=ctx.commit({type:'rat-review-set',demandId:fresh.id,month:fresh.month,result,revisions:Object.fromEntries(fresh.tasks.map(t=>[t.id,t.revision]))});if(!r.ok){syncReview(item);ctx.toast(r.message||'未能保存',true);return;}
      if(formState?.surface===drawer&&drawer.open&&formState.demandId===item.id){const updated=entry(item.id,item.month);formState.taskRevisions=Object.fromEntries(updated.tasks.map(t=>[t.id,t.revision]));syncReview(updated);}
    };
    if(dirty&&formState?.surface===drawer){if(!await saveForm()){syncReview(item);return;}}apply();
  }
  function handle(action,b){
    DD.close();if(action==='clear-plan-field'){const field=drawer.querySelector('[data-structured-field="'+b.dataset.field+'"]');field.value='';if(field.tagName==='SELECT')field.querySelector('option[value=""]').textContent='未填写';formState.patchKeys.add(b.dataset.field);dirty=true;const hint=drawer.querySelector('[data-conflict-for="'+b.dataset.field+'"]');hint.textContent='已清空，保存后生效';window.LubanSelect.enhance(drawer);return;}if(action==='new-demand')openQuick('demand');if(action==='new-rat')openQuick('plan');if(action==='add-to-rat')openQuick('plan',b.dataset.id);if(action==='open-demand')openDrawer('demand',b.dataset.id);if(action==='open-plan')openDrawer('plan',b.dataset.id,month,b.dataset.focusField||'');if(action==='close')close();if(action==='save-form')saveForm();if(action==='tab'){tab=b.dataset.tab;render();}
  }
  for(const surface of [root,quick,drawer])surface.addEventListener('click',event=>{const b=event.target.closest('[data-intake-action]');if(b){event.stopPropagation();handle(b.dataset.intakeAction,b);}});
  root.addEventListener('input',event=>{if(event.target.id==='intake-search'){const pos=event.target.selectionStart;search=event.target.value;render();const input=root.querySelector('#intake-search');input.focus();input.setSelectionRange(pos,pos);}});
  root.addEventListener('change',event=>{
    const el=event.target;if(el.matches('[data-review-demand]')){review(el);return;}
    if(el.name==='rat-visible-field'){el.checked?shown.add(el.value):shown.delete(el.value);try{localStorage.setItem(columnsKey,JSON.stringify([...shown]));}catch{}render();return;}
    const tagKey=M.tagFields.find(key=>el.name==='filter-'+key);if(tagKey){tagFilters[tagKey]=el.checked?[...new Set([...tagFilters[tagKey],el.value])]:tagFilters[tagKey].filter(value=>value!==el.value);render();return;}
    if(el.id==='intake-module')module=el.value;else if(el.id==='intake-source')source=el.value;else if(el.id==='intake-month')month=el.value;else if(el.id==='intake-status')resultFilter=el.value;else return;render();
  });
  for(const surface of [quick,drawer]){
    surface.addEventListener('submit',event=>{event.preventDefault();saveForm();});
    surface.addEventListener('input',event=>{if(surface===drawer&&event.target.name==='notesText')fitNotes();if(!event.target.matches('[data-review-demand]')){dirty=true;if(formState&&event.target.dataset.structuredField)formState.patchKeys.add(event.target.dataset.structuredField);(surface===drawer?drawer.querySelector('.intake-drawer-error'):quick.querySelector('[role="alert"]')).textContent='';}});
    surface.addEventListener('change',event=>{if(event.target.matches('[data-review-demand]'))review(event.target);else{dirty=true;if(formState&&event.target.dataset.structuredField)formState.patchKeys.add(event.target.dataset.structuredField);}});
    surface.addEventListener('cancel',event=>{event.preventDefault();close();});
    surface.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.shiftKey&&!event.isComposing&&!event.target.closest('[data-rich-editor]')){event.preventDefault();saveForm();}});
    let pointer=null;const outside=event=>{const r=surface.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
    surface.addEventListener('pointerdown',event=>{pointer=event.target===surface&&outside(event)?event.pointerId:null;});surface.addEventListener('pointerup',event=>{if(pointer===event.pointerId&&event.target===surface&&outside(event))close();pointer=null;});
  }
  discard.addEventListener('click',event=>{const b=event.target.closest('[data-discard]');if(!b)return;discard.close();if(b.dataset.discard==='yes'){dirty=false;const next=pendingLeave;pendingLeave=null;guard(next||(()=>{}));}else pendingLeave=null;});
  window.addEventListener('beforeunload',event=>{if(dirty&&formState?.surface.open){event.preventDefault();event.returnValue='';}});
  window.addEventListener('resize',()=>{if(drawer.open)fitNotes();});
  return {render,openDemand:id=>openDrawer('demand',id),hasDrafts:()=>dirty&&!!formState?.surface.open,guard};
};
