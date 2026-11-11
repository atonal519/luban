/* Administrative module groups share one monthly resource table. */
window.createRatResourceUI = function(ctx) {
  const root=ctx.root,e=ctx.esc,M=window.LubanRat,unassigned='__unassigned__',unassignedLabel='归属待明确';
  let month=ctx.today?.slice(0,7)||'2026-11',scope='passed',module='',search='',open=new Set(),fields=new Set(['effort','tasks','capacity','balance']);
  const number=n=>Number(n.toFixed(2)).toLocaleString('zh-CN');
  const fieldList=[['modules','归属模块'],['effort','已明确人天'],['tasks','工作项数'],['capacity','月度容量'],['balance','余量与负荷']];
  // Populate this display roster locally; it grants no account role.
  const teamLeads={};
  const leadOrder=new Map(Object.values(teamLeads).flat().map((name,index)=>[name,index]));
  const label=t=>t.review?.result==='passed'?'已通过':t.review?.result==='rejected'?'不通过':'未选择';
  const current=t=>{
    if(t.review?.result!=='passed')return '未纳入本月执行';
    const fe=ctx.getRecords().find(r=>r.id===t.feId);return fe?ctx.stateLabel(fe):'未纳入执行';
  };
  function workGroups(tasks){
    const groups=new Map();
    for(const task of tasks){const key=task.demandId||task.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(task);}
    return [...groups.values()];
  }
  function expandedWork(person){
    if(!person.tasks.length)return '<p class="rat-resource-empty-work">当前范围暂无工作，可切换全部 RAT 查看。</p>';
    return '<table class="rat-work-table" aria-label="'+e(person.name)+'的工作"><colgroup><col><col style="width:120px"><col style="width:120px"><col style="width:160px"></colgroup><thead><tr><th scope="col">工作内容</th><th scope="col">任务模块</th><th scope="col">本人人天</th><th scope="col">状态</th></tr></thead><tbody>'+workGroups(person.tasks).map(tasks=>{
      const task=tasks[0],values=tasks.map(unit=>M.effort(unit.effort,M.names(unit.owner)).allocations.find(a=>a.person===person.name)?.days??null);
      const days=values.reduce((sum,value)=>sum+(value??0),0),unknown=values.some(value=>value===null),effort=unknown?(days?number(days)+' + 待明确':'待明确'):number(days)+' 人天';
      const modules=[...new Set(tasks.flatMap(unit=>(unit.modules||[unit.module]).filter(Boolean)))];
      const reviews=[...new Set(tasks.map(label))],states=[...new Set(tasks.map(current))],status=(scope==='all'?reviews.join(' / ')+' · ':'')+states.join(' / ');
      return '<tr data-resource-work="'+e(task.demandId||task.id)+'"><td><button type="button" class="text-button rat-resource-work-link" data-resource-action="task" data-id="'+e(task.id)+'" title="'+e(task.title)+'">'+e(task.title)+'</button></td><td>'+e(modules.join('、'))+'</td><td class="'+(unknown?'rat-resource-warning':'')+'">'+e(effort)+'</td><td>'+e(status)+'</td></tr>';
    }).join('')+'</tbody></table>';
  }
  function personRow(p,span){
    const balance=p.overloaded?(p.unknown?'至少超排 ':'超排 ')+number(p.days-p.capacity)+' 人天':p.remaining===null?'余量待明确':p.remaining===0?'已排满':'还可排 '+number(p.remaining)+' 人天';
    const load=p.unknown&&p.days===0?'负荷待明确':(p.unknown?'已知负荷 ':'负荷 ')+Math.round(100*p.days/p.capacity)+'%';
    const expanded=open.has(p.name),tone=p.overloaded?'rat-resource-overloaded':p.unknown?'rat-resource-warning':'';
    let cells='<td><button type="button" class="text-button rat-person-button" data-resource-action="expand" data-person="'+e(p.name)+'" aria-expanded="'+expanded+'">'+e(p.name)+(leadOrder.has(p.name)?'（TL）':'')+'<span class="rat-person-hint">'+(expanded?'收起':'查看工作')+'</span></button></td>';
    if(fields.has('modules'))cells+='<td>'+e(p.homeModule||unassignedLabel)+'</td>';
    if(fields.has('effort'))cells+='<td><strong>'+(p.tasks.length?(p.unknown&&p.days===0?'待明确':number(p.days)+' 人天'):'暂无安排')+'</strong>'+(p.unknown?'<span class="rat-resource-warning rat-resource-pending">另 '+p.unknown+' 项待明确</span>':'')+'</td>';
    if(fields.has('tasks'))cells+='<td>'+workGroups(p.tasks).length+' 项</td>';
    if(fields.has('capacity'))cells+='<td>'+number(p.capacity)+' 人天</td>';
    if(fields.has('balance'))cells+='<td class="'+tone+'"><div class="rat-workload-inline"><span>'+e(p.unknown&&p.days===0?balance:balance+' · '+load)+'</span>'+(!p.unknown||p.days>0?'<span class="rat-load-track" aria-hidden="true"><i style="width:'+Math.min(100,100*p.days/p.capacity)+'%"></i></span>':'')+'</div></td>';
    return '<tr data-resource-person="'+e(p.name)+'" class="'+(expanded?'is-expanded':'')+'">'+cells+'</tr>'+(expanded?'<tr class="rat-resource-expanded"><td colspan="'+span+'">'+expandedWork(p)+'</td></tr>':'');
  }
  function render(){
    const summary=M.resources(ctx.getState(),month,scope),people=summary.people.filter(p=>(!module||(p.homeModule||unassigned)===module)&&(!search||[p.name,p.homeModule||unassignedLabel].join(' ').toLowerCase().includes(search.toLowerCase())));
    const overloaded=summary.people.filter(p=>p.overloaded),underfilled=summary.people.filter(p=>p.remaining>0),full=summary.people.filter(p=>p.remaining===0),unknown=summary.people.filter(p=>p.remaining===null&&!p.overloaded);
    const months=[...new Set([month,ctx.today?.slice(0,7)||month,...ctx.getState().tasks.map(t=>t.month)])].sort();
    const moduleNames=[...new Set([...(ctx.modules||[]),...summary.people.map(p=>p.homeModule).filter(Boolean)])];
    const moduleOptions=[['','全部模块'],...moduleNames.map(value=>[value,value]),...(module===unassigned||summary.people.some(p=>!p.homeModule)?[[unassigned,unassignedLabel]]:[])];
    const hasKnown=typeof summary.knownRows==='number'?summary.knownRows>0:summary.totalDays>0||summary.unknownRows===0;
    const total=summary.taskCount>0&&!hasKnown?'待明确':number(summary.totalDays)+' 人天';
    const average=!summary.people.length?'—':summary.taskCount>0&&!hasKnown?'待明确':number(summary.totalDays/summary.people.length)+' 人天';
    const visible=fieldList.filter(([key])=>fields.has(key)),span=1+visible.length,groups=new Map();
    for(const p of people){const key=p.homeModule||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
    for(const group of groups.values())group.sort((a,b)=>(leadOrder.get(a.name)??leadOrder.size)-(leadOrder.get(b.name)??leadOrder.size));
    const groupNames=[...moduleNames,''].filter(key=>groups.has(key));
    const body=groupNames.map((key,index)=>'<tbody data-resource-module="'+e(key||unassigned)+'" aria-labelledby="rat-module-'+index+'"><tr class="rat-resource-group"><th scope="rowgroup" id="rat-module-'+index+'" colspan="'+span+'">'+e(key||unassignedLabel)+'<span>'+groups.get(key).length+' 人</span></th></tr>'+groups.get(key).map(p=>personRow(p,span)).join('')+'</tbody>').join('');
    const empty='<tbody><tr><td colspan="'+span+'" class="rat-resource-empty">'+(summary.people.length?'没有匹配人员':'该月暂无人员安排')+'</td></tr></tbody>';
    return '<section class="rat-resources" aria-label="人力资源池"><div class="intake-toolbar rat-resource-toolbar"><label>计划月份<select id="rat-resource-month">'+months.map(m=>'<option '+(m===month?'selected':'')+'>'+e(m)+'</option>').join('')+'</select></label><label>统计范围<select id="rat-resource-scope"><option value="passed" '+(scope==='passed'?'selected':'')+'>已通过</option><option value="all" '+(scope==='all'?'selected':'')+'>全部 RAT（含未评审与不通过）</option></select></label><label>模块<select id="rat-resource-module">'+moduleOptions.map(([value,text])=>'<option value="'+e(value)+'" '+(module===value?'selected':'')+'>'+e(text)+'</option>').join('')+'</select></label><label class="search"><span>'+ctx.icon('search')+'</span><input id="rat-person-search" placeholder="搜索人员或模块" aria-label="搜索人员或模块" value="'+e(search)+'"></label>'+window.LubanCheckDropdown.render({id:'resource-field-picker',label:'显示字段',options:fieldList,selected:[...fields],attribute:'resource-field'})+'</div><div class="rat-resource-metrics" aria-label="全月汇总"><span class="rat-resource-summary-label">全月汇总</span><span><strong>'+summary.people.length+' 人</strong></span><span>'+(scope==='passed'?'已通过':'全部')+' · 已明确 <strong>'+e(total)+'</strong></span><span data-resource-average>人均 <strong>'+e(average)+'</strong></span><span class="rat-resource-overloaded">'+overloaded.length+' 人超排</span><span>'+underfilled.length+' 人未排满</span><span>'+full.length+' 人已排满</span><span>'+unknown.length+' 人待明确</span><span>每人每月固定 '+M.monthlyCapacity+' 人天</span></div><div class="intake-table-wrap"><table class="intake-table rat-resource-table"><thead><tr><th scope="col">人员</th>'+visible.map(([,name])=>'<th scope="col">'+e(name)+'</th>').join('')+'</tr></thead>'+ (body||empty)+'</table></div><p class="section-description rat-resource-footer">当前显示 '+people.length+' 人 · 本月 '+summary.taskCount+' 项工作 · '+summary.unallocatedRows+' 项分配待明确 · 多人总人天默认均摊</p></section>';
  }
  root.addEventListener('click',event=>{
    const b=event.target.closest('[data-resource-action]');if(!b)return;
    if(b.dataset.resourceAction==='expand'){open.has(b.dataset.person)?open.delete(b.dataset.person):open.add(b.dataset.person);ctx.render();}
    if(b.dataset.resourceAction==='task')ctx.openTask(b.dataset.id);
  });
  root.addEventListener('change',event=>{
    const t=event.target;
    if(t.id==='rat-resource-month'){month=t.value;ctx.onMonthChange?.(month);ctx.render();}
    if(t.id==='rat-resource-scope'){scope=t.value;ctx.render();}
    if(t.id==='rat-resource-module'){module=t.value;ctx.render();}
    if(t.dataset?.resourceField){t.checked?fields.add(t.dataset.resourceField):fields.delete(t.dataset.resourceField);ctx.render();}
  });
  root.addEventListener('input',event=>{if(event.target.id==='rat-person-search'){const pos=event.target.selectionStart;search=event.target.value;ctx.render();const input=root.querySelector('#rat-person-search');input.focus();input.setSelectionRange(pos,pos);}});
  const setMonth=value=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value))month=value;};
  return {render,setMonth};
};
