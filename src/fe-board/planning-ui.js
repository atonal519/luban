/* The settings page and FE shortcut share one draft and one persisted ruleset. */
window.createPlanningUI=function(ctx){
  const {esc:e,icon,getRules,saveRules,onSaved,toast}=ctx,M=window.LubanPlanning;
  const $=id=>document.getElementById(id);
  let draft=null,feedback='';
  const strings=rules=>M.normalizeRules(rules).gaps.map(x=>x===null?'':String(x));
  const values=()=>draft||strings(getRules());
  const dirty=()=>draft!==null&&JSON.stringify(draft)!==JSON.stringify(strings(getRules()));
  function formMarkup(prefix){
    const current=values();
    return '<form class="planning-form" data-planning-form novalidate><p class="planning-summary">填写相邻阶段间隔的工作日，自动跳过周六、周日。</p><div class="planning-rules">'+M.nodes.slice(0,-1).map((node,i)=>'<label class="planning-rule" for="'+prefix+'-'+i+'"><span><strong>'+node.name+'</strong><span class="planning-rule-arrow" aria-hidden="true">→</span>'+M.nodes[i+1].name+'</span><span class="planning-rule-input"><input id="'+prefix+'-'+i+'" type="number" min="0" max="3650" step="1" inputmode="numeric" data-rule-gap="'+i+'" aria-label="'+node.name+'到'+M.nodes[i+1].name+'间隔" value="'+e(current[i])+'" placeholder="未设置"><span>工作日</span></span></label>').join('')+'</div><p class="form-tip">留空不计算这一段；0 表示同一天。只补空白计划，已有日期与手改日期保留。</p><p class="planning-error field-error" role="alert"></p><div class="planning-form-actions"><button class="btn primary" type="submit">保存规则</button><button class="btn" type="button" data-action="planning-cancel">取消修改</button><span class="planning-save-feedback" role="status">'+e(dirty()?'未保存':feedback||'')+'</span></div></form>';
  }
  function renderPage(){
    const roster=window.LubanPMDirectory.roster,people=[...new Set(Object.values(roster))];
    $('aux-workspace').innerHTML='<div class="page-heading"><div class="page-title"><h1>设置</h1></div></div><div class="settings-layout"><section class="settings-card"><div class="settings-card-heading"><h2>研发排期规则</h2><span class="settings-pill">工作日 · 跳过周末</span></div>'+formMarkup('planning-page')+'</section><section class="settings-card pm-directory-card"><h2>模块 PM 分工</h2><dl class="pm-directory">'+people.map(name=>'<div><dt>'+Object.keys(roster).filter(m=>roster[m]===name).join('、')+'</dt><dd>'+name+'</dd></div>').join('')+'</dl><p class="form-tip">仅补空白 PM；跨模块按牵头模块确定，不覆盖手工指定。</p></section></div>';
  }
  function renderDialog(){
    $('planning-dialog').innerHTML='<div class="modal-heading"><h2 id="planning-title">研发排期规则</h2><button type="button" class="btn icon-button" data-action="planning-close" aria-label="关闭排期规则">'+icon('close')+'</button></div><div class="modal-body">'+formMarkup('planning-dialog-gap')+'</div>';
  }
  function open(){renderDialog();if(!$('planning-dialog').open)$('planning-dialog').showModal();}
  function redraw(){if($('planning-dialog').open)renderDialog();else renderPage();}
  function handleClick(button){
    if(button.dataset.action==='planning-open'){open();return true;}
    if(button.dataset.action==='planning-close'){$('planning-dialog').close();return true;}
    if(button.dataset.action==='planning-cancel'){draft=null;feedback='';redraw();return true;}
    return false;
  }
  document.addEventListener('input',event=>{
    const form=event.target.closest('[data-planning-form]');if(!form)return;
    draft=[...form.querySelectorAll('[data-rule-gap]')].map(el=>el.value);
    form.querySelector('.planning-save-feedback').textContent=dirty()?'未保存':feedback;
  });
  document.addEventListener('submit',event=>{
    const form=event.target;if(!form.matches('[data-planning-form]'))return;
    event.preventDefault();draft=[...form.querySelectorAll('[data-rule-gap]')].map(el=>el.value);
    try{
      const rules=M.normalizeRules({gaps:draft});
      if(!saveRules(rules)){form.querySelector('.planning-error').textContent='未能保存，输入已保留，请重试。';return;}
      draft=null;feedback='已保存';redraw();onSaved?.();toast('排期规则已保存');
    }catch(error){form.querySelector('.planning-error').textContent=error.message;}
  });
  window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
  return {renderPage,open,handleClick};
};
