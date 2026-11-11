/* Checkbox popovers share one compact control without changing table geometry. */
window.LubanCheckDropdown=(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let opened='';
  function render({id,label,options,selected=[],name='',attribute='',summary=false,allowCreate=false,createLabel=label}){
    const choices=new Set(selected),caption=summary&&choices.size?[...choices].join('、'):label;
    const items=options.map(([value,text])=>'<label><input type="checkbox" '+(name?'name="'+esc(name)+'" ':'')+(attribute?'data-'+attribute+'="'+esc(value)+'" ':'')+'value="'+esc(value)+'" '+(choices.has(value)?'checked':'')+'><span>'+esc(text)+'</span></label>').join('');
    return '<div class="check-dropdown" data-check-dropdown="'+esc(id)+'" '+(allowCreate?'data-check-creatable data-check-name="'+esc(name)+'"':'')+'><button type="button" class="btn check-dropdown-trigger" aria-expanded="'+(opened===id)+'" aria-controls="'+esc(id)+'-options" data-check-trigger="'+esc(id)+'" data-check-label="'+esc(label)+'" '+(summary?'data-check-summary':'')+'><span>'+esc(caption)+'</span></button><div class="check-dropdown-panel" id="'+esc(id)+'-options" '+(opened===id?'':'hidden')+' role="group" aria-label="'+esc(createLabel)+'">'+(allowCreate?'<div class="check-dropdown-choices">'+items+'</div><div class="check-dropdown-create"><input type="text" data-check-new aria-label="新增'+esc(createLabel)+'" placeholder="新增选项，Enter 确认"><button type="button" class="btn" data-check-add aria-label="添加'+esc(createLabel)+'选项">添加</button></div>':items)+'</div></div>';
  }
  function place(wrapper){
    const panel=wrapper.querySelector('.check-dropdown-panel'),anchor=wrapper.getBoundingClientRect(),clip=wrapper.closest('.modal-body,.drawer-scroll')?.getBoundingClientRect();
    const left=Math.max(12,clip?.left||0),right=Math.min(innerWidth-12,clip?.right||innerWidth),top=Math.max(12,clip?.top||0),bottom=Math.min(innerHeight-12,clip?.bottom||innerHeight);
    panel.style.maxWidth=(right-left)+'px';panel.style.right='auto';panel.style.left=(Math.max(left,Math.min(anchor.left,right-panel.offsetWidth))-anchor.left)+'px';
    const below=bottom-anchor.bottom-6,above=anchor.top-top-6,up=below<Math.min(panel.scrollHeight,250)&&above>below;
    panel.style.top=up?'auto':'calc(100% + 6px)';panel.style.bottom=up?'calc(100% + 6px)':'auto';panel.style.maxHeight=Math.max(80,Math.min(250,up?above:below))+'px';
  }
  function createChoice(wrapper,focus=true){
    const field=wrapper.querySelector('[data-check-new]'),value=field?.value.trim();if(!value)return;
    const list=wrapper.querySelector('.check-dropdown-choices');let input=[...list.querySelectorAll('input')].find(input=>input.value===value);
    if(!input){const label=document.createElement('label'),span=document.createElement('span');input=document.createElement('input');input.type='checkbox';input.name=wrapper.dataset.checkName;input.value=value;span.textContent=value;label.append(input,span);list.append(label);}
    input.checked=true;field.value='';input.dispatchEvent(new Event('change',{bubbles:true}));if(focus)field.focus();
  }
  const flush=surface=>surface.querySelectorAll('[data-check-creatable]').forEach(wrapper=>createChoice(wrapper,false));
  const fit=(surface=document)=>{const wrapper=[...surface.querySelectorAll('[data-check-dropdown]')].find(wrapper=>wrapper.dataset.checkDropdown===opened);if(wrapper)place(wrapper);};
  function close(){opened='';document.querySelectorAll('[data-check-dropdown]').forEach(w=>{w.querySelector('[data-check-trigger]').setAttribute('aria-expanded','false');w.querySelector('.check-dropdown-panel').hidden=true;});}
  document.addEventListener('click',event=>{
    const add=event.target.closest('[data-check-add]');if(add){createChoice(add.closest('[data-check-dropdown]'));return;}
    const trigger=event.target.closest('[data-check-trigger]');
    if(trigger){const id=trigger.dataset.checkTrigger,wasOpen=opened===id;close();if(!wasOpen){opened=id;trigger.setAttribute('aria-expanded','true');trigger.parentElement.querySelector('.check-dropdown-panel').hidden=false;place(trigger.parentElement);}return;}
    if(!event.target.closest('[data-check-dropdown]'))close();
  });
  document.addEventListener('change',event=>{
    const wrapper=event.target.closest('[data-check-dropdown]'),trigger=wrapper?.querySelector('[data-check-summary]');
    if(trigger){const labels=[...wrapper.querySelectorAll('input:checked')].map(x=>x.value);trigger.querySelector('span').textContent=labels.join('、')||trigger.dataset.checkLabel;}
  });
  document.addEventListener('keydown',event=>{
    const wrapper=event.target.closest('[data-check-dropdown]');
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.target.matches('[data-check-new]')){event.preventDefault();event.stopPropagation();createChoice(wrapper);return;}
    if(event.key==='Escape'&&opened){event.preventDefault();event.stopPropagation();const trigger=document.querySelector('[data-check-trigger="'+opened+'"]');close();trigger?.focus();}
    if(event.key==='ArrowDown'&&event.target.matches('[data-check-trigger]')){event.preventDefault();if(wrapper.querySelector('.check-dropdown-panel').hidden)event.target.click();wrapper.querySelector('input')?.focus();}
  },true);
  window.addEventListener('resize',()=>fit());
  return {render,close,flush,fit};
})();
