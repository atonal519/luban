/* Small rich-text editor shared by compact creation and right-side details. */
window.LubanRichEditor=(()=>{
  const bound=new WeakMap(),ranges=new WeakMap(),reported=new WeakMap(),composing=new WeakSet(),handledPastes=new WeakSet();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const editorOf=node=>node?.matches?.('[data-rich-editor]')?node:node?.closest?.('[data-rich-editor]')||node?.querySelector?.('[data-rich-editor]');
  const surfaceOf=editor=>editor?.querySelector('[data-rich-surface]');
  const editable=editor=>surfaceOf(editor)?.getAttribute('contenteditable')==='true';
  function safe(html){
    const template=document.createElement('template');template.innerHTML=window.LubanRichText.clean(html);
    template.content.querySelectorAll('a').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});
    return template.innerHTML;
  }
  function read(node){
    const editor=editorOf(node),surface=surfaceOf(editor);if(!surface)return {html:'',text:''};
    const html=safe(surface.innerHTML),template=document.createElement('template');template.innerHTML=html;
    const blocks=new Set(['P','DIV','LI','UL','OL','BLOCKQUOTE','H2','H3','H4','PRE','TR','TD','TH']);let text='';
    const newline=()=>{if(text&&!text.endsWith('\n'))text+='\n';};
    const walk=node=>{
      if(node.nodeType===Node.TEXT_NODE){text+=node.textContent;return;}
      if(node.nodeName==='BR'){text+='\n';return;}
      if(blocks.has(node.nodeName))newline();
      for(const child of node.childNodes)walk(child);
      if(blocks.has(node.nodeName))newline();
    };
    walk(template.content);text=text.replace(/\n{3,}/g,'\n\n').trim();
    return {html:text?html:'',text};
  }
  function markup({id,html='',label='内容详情',compact=false,readonly=false}){
    const key=String(id||'rich-content'),caption=String(label||'内容详情');
    return '<div class="luban-rich-editor'+(compact?' is-compact':'')+(readonly?' is-readonly':'')+'" data-rich-editor="'+escape(key)+'">'+
      (label?'<div class="luban-rich-label" id="'+escape(key)+'-label">'+escape(label)+'</div>':'')+
      '<div class="luban-rich-shell">'+(!readonly?'<div class="luban-rich-toolbar" role="toolbar" aria-label="'+escape(caption)+'格式">'+
        '<button type="button" data-rich-command="bold" aria-label="粗体" aria-pressed="false" title="粗体"><b aria-hidden="true">B</b></button>'+
        '<button type="button" data-rich-command="italic" aria-label="斜体" aria-pressed="false" title="斜体"><i aria-hidden="true">I</i></button>'+
        '<button type="button" class="rich-list-button" data-rich-command="insertUnorderedList" aria-label="项目列表" aria-pressed="false" title="项目列表"><span aria-hidden="true">• 列表</span></button></div>':'')+
      '<div id="'+escape(key)+'" class="luban-rich-surface" data-rich-surface role="textbox" aria-multiline="true" '+(label?'aria-labelledby="'+escape(key)+'-label"':'aria-label="'+escape(caption)+'"')+' contenteditable="'+!readonly+'" aria-readonly="'+readonly+'" data-placeholder="填写内容详情（选填）" tabindex="0" spellcheck="false">'+safe(html)+'</div></div></div>';
  }
  function remember(editor){
    const surface=surfaceOf(editor),selection=document.getSelection();if(!surface||!selection?.rangeCount)return;
    const range=selection.getRangeAt(0);if(surface.contains(range.commonAncestorContainer))ranges.set(editor,range.cloneRange());
  }
  function restore(editor){
    const surface=surfaceOf(editor);surface.focus();const selection=document.getSelection(),saved=ranges.get(editor);
    const range=saved&&surface.contains(saved.commonAncestorContainer)?saved:document.createRange();
    if(range!==saved){range.selectNodeContents(surface);range.collapse(false);}
    selection.removeAllRanges();selection.addRange(range);
  }
  function refresh(editor){
    if(!editable(editor))return;
    for(const button of editor.querySelectorAll('[data-rich-command]')){
      let pressed=false;try{pressed=document.queryCommandState(button.dataset.richCommand);}catch{}
      button.setAttribute('aria-pressed',String(pressed));
    }
  }
  function bind(root,callbacks={}){
    if(bound.has(root)){bound.get(root).callbacks=callbacks;return bound.get(root).dispose;}
    const state={callbacks,listeners:[]};
    const payload=(editor,event)=>({id:editor.dataset.richEditor,editor,...read(editor),event});
    const change=(editor,event)=>{
      if(!editable(editor))return;remember(editor);refresh(editor);
      const value=payload(editor,event);if(reported.get(editor)===value.html)return;
      reported.set(editor,value.html);state.callbacks.onChange?.(value);
    };
    const listen=(type,handler)=>{root.addEventListener(type,handler);state.listeners.push([type,handler]);};
    for(const editor of root.matches?.('[data-rich-editor]')?[root]:root.querySelectorAll('[data-rich-editor]'))reported.set(editor,read(editor).html);
    listen('input',event=>{const editor=editorOf(event.target);if(editor&&root.contains(editor))change(editor,event);});
    listen('compositionstart',event=>{const editor=editorOf(event.target);if(editor)composing.add(editor);});
    listen('compositionend',event=>{const editor=editorOf(event.target);if(editor){composing.delete(editor);change(editor,event);}});
    listen('keydown',event=>{
      if(!event.target.matches?.('[data-rich-surface]'))return;
      const editor=editorOf(event.target);if(!editable(editor)||event.isComposing||event.keyCode===229||composing.has(editor))return;
      if(event.key==='Enter'){
        event.preventDefault();event.stopPropagation();
        if(event.shiftKey)state.callbacks.onSave?.(payload(editor,event));
        else{document.execCommand('insertParagraph',false);change(editor,event);}
      }
    });
    listen('paste',event=>{
      if(handledPastes.has(event))return;
      if(!event.target.matches?.('[data-rich-surface]'))return;
      const editor=editorOf(event.target);if(!editable(editor))return;
      const clipboard=event.clipboardData;if(!clipboard)return;
      handledPastes.add(event);
      event.preventDefault();
      const html=clipboard.getData('text/html'),plain=clipboard.getData('text/plain');
      document.execCommand('insertHTML',false,safe(html||window.LubanRichText.fromText(plain)));change(editor,event);
    });
    listen('mousedown',event=>{
      const button=event.target.closest?.('[data-rich-command]');if(!button)return;
      const editor=editorOf(button);if(!editable(editor))return;
      remember(editor);event.preventDefault();
    });
    listen('click',event=>{
      const button=event.target.closest?.('[data-rich-command]');if(button){
        const editor=editorOf(button);if(!editable(editor))return;
        event.preventDefault();event.stopPropagation();restore(editor);
        document.execCommand(button.dataset.richCommand,false);change(editor,event);refresh(editor);return;
      }
      // Editing a link should keep the editor in place; readonly links can open normally.
      const anchor=event.target.closest?.('[data-rich-surface] a');if(anchor&&editable(editorOf(anchor)))event.preventDefault();
    });
    for(const type of ['keyup','mouseup','focusin','focusout'])listen(type,event=>{
      const editor=editorOf(event.target);if(editor&&editable(editor)){remember(editor);refresh(editor);}
    });
    state.dispose=()=>{for(const [type,handler]of state.listeners)root.removeEventListener(type,handler);bound.delete(root);};
    bound.set(root,state);return state.dispose;
  }
  return {markup,bind,read};
})();
