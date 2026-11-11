/* Source evidence owns its image references; other rich-text fields stay text-only. */
window.LubanSourceEvidence=(()=>{
  const states=new WeakMap(),roots=new WeakMap();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wrappers=node=>node?.matches?.('[data-source-evidence]')?[node]:node?.closest?.('[data-source-evidence]')?[node.closest('[data-source-evidence]')]:[...node?.querySelectorAll?.('[data-source-evidence]')||[]];
  const refs=items=>(Array.isArray(items)?items:[]).filter(x=>x&&typeof x.id==='string').map(x=>({id:x.id,name:String(x.name||'图片'),mime:String(x.mime||''),size:Number(x.size)||0,width:Number(x.width)||0,height:Number(x.height)||0}));
  const linksOf=value=>[...new Set((Array.isArray(value)?value:[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];
  function parse(wrapper,key,fallback){try{return JSON.parse(wrapper.dataset[key]||JSON.stringify(fallback));}catch{return fallback;}}
  const safeURL=value=>{try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}};
  const textURLs=value=>linksOf(String(value||'').match(/https?:\/\/[^\s<>"']+/g)||[]).map(value=>value.replace(/[。；，、）\]}>]+$/u,''));
  function currentValue(wrapper){
    const value=window.LubanRichEditor.read(wrapper.querySelector('[data-rich-editor]')),template=document.createElement('template');template.innerHTML=value.html;
    const links=linksOf([...textURLs(value.text),...[...template.content.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(safeURL)]);
    return {...value,links};
  }
  function snapshot(state){return {...currentValue(state.wrapper),images:refs(state.images)};}
  function initial(wrapper){return {...currentValue(wrapper),images:refs(parse(wrapper,'sourceImages',[]))};}
  function exposeLinks(container){
    const selection=document.getSelection();let anchorNode=selection?.anchorNode,anchorOffset=selection?.anchorOffset,focusNode=selection?.focusNode,focusOffset=selection?.focusOffset,restore=false;
    const offsetIn=(anchor,node,offset)=>{const range=document.createRange();range.selectNodeContents(anchor);range.setEnd(node,offset);return range.toString().length;};
    for(const anchor of container.querySelectorAll('a[href]')){
      const href=anchor.getAttribute('href'),label=anchor.textContent||'';
      const value=safeURL(href)&&!textURLs(label).includes(href)?[label,href].filter(Boolean).join(' '):label,replacement=document.createTextNode(value);
      if(anchorNode&&anchor.contains(anchorNode)){const offset=offsetIn(anchor,anchorNode,anchorOffset);anchorNode=replacement;anchorOffset=offset===label.length?value.length:offset;restore=true;}
      if(focusNode&&anchor.contains(focusNode)){const offset=offsetIn(anchor,focusNode,focusOffset);focusNode=replacement;focusOffset=offset===label.length?value.length:offset;restore=true;}
      anchor.replaceWith(replacement);
    }
    if(restore&&anchorNode?.isConnected&&focusNode?.isConnected)selection.setBaseAndExtent(anchorNode,anchorOffset,focusNode,focusOffset);
  }
  function visibleURLs(container){
    const clone=container.cloneNode(true);
    for(const br of clone.querySelectorAll('br'))br.replaceWith(document.createTextNode('\n'));
    for(const block of clone.querySelectorAll('p,div,li,blockquote,h1,h2,h3,h4,pre'))block.append(document.createTextNode('\n'));
    return textURLs(clone.textContent);
  }
  function linkifyReadonly(container){
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT),nodes=[];let node;
    while(node=walker.nextNode())if(!node.parentElement?.closest('a'))nodes.push(node);
    for(const textNode of nodes){
      const text=textNode.textContent,fragment=document.createDocumentFragment();let index=0,changed=false;
      for(const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)){
        const url=textURLs(match[0])[0];if(!safeURL(url))continue;
        fragment.append(document.createTextNode(text.slice(index,match.index)));
        const anchor=document.createElement('a');anchor.href=url;anchor.textContent=url;fragment.append(anchor);index=match.index+url.length;changed=true;
      }
      if(changed){fragment.append(document.createTextNode(text.slice(index)));textNode.replaceWith(fragment);}
    }
  }
  function contentHTML(value,readonly){
    const template=document.createElement('template');template.innerHTML=window.LubanRichText.clean(value.html||window.LubanRichText.fromText(value.text||''));
    const existing=new Set([...visibleURLs(template.content),...[...template.content.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))]);
    for(const link of linksOf(value.links))if(!existing.has(link)){
      const paragraph=document.createElement('p');paragraph.textContent=link;template.content.append(paragraph);existing.add(link);
    }
    if(readonly)linkifyReadonly(template.content);else exposeLinks(template.content);
    return template.innerHTML;
  }
  function alive(state){return !state.disposed&&states.get(state.wrapper)===state&&state.wrapper.isConnected;}
  function contextAlive(state,dialog){return alive(state)&&(!dialog||dialog.open);}
  function payload(state,event,extra={}){const value=snapshot(state);return {id:state.wrapper.dataset.sourceEvidence,wrapper:state.wrapper,value,...value,event,pending:state.pending.size>0,...extra};}
  function changed(state,event,extra){if(alive(state))state.callbacks.onChange?.(payload(state,event,extra));}
  function notify(state,error){if(alive(state))state.callbacks.onError?.({...payload(state,null),message:error.message,error});}
  function markup({id,label='来源明细',value={},readonly=false}){
    const key=String(id||'source-evidence'),images=refs(value.images),template=document.createElement('template');
    template.innerHTML=window.LubanRichEditor.markup({id:key+'-text',label,html:contentHTML(value,readonly),compact:true,readonly});
    const shell=template.content.querySelector('.luban-rich-shell');
    if(!readonly){
      const toolbar=shell.querySelector('.luban-rich-toolbar');
      toolbar.insertAdjacentHTML('beforeend','<button type="button" class="source-evidence-image-button" data-evidence-action="choose">添加图片</button><input type="file" data-source-file accept="image/png,image/jpeg,image/webp" multiple aria-label="选择来源图片" hidden>');
    }
    shell.insertAdjacentHTML('beforeend','<div class="source-evidence-images" data-evidence-images role="list" aria-label="来源图片"></div><div class="source-evidence-uploads" data-evidence-uploads></div><p class="source-evidence-notice" data-evidence-notice role="alert"></p>');
    return '<section class="source-evidence'+(readonly?' is-readonly':'')+'" data-source-evidence="'+escape(key)+'" data-source-readonly="'+readonly+'" data-source-images="'+escape(JSON.stringify(images))+'">'+template.innerHTML+'</section>';
  }
  function renderUploads(state){
    const container=state.wrapper.querySelector('[data-evidence-uploads]');container.replaceChildren();
    for(const item of state.uploads.values()){
      const row=document.createElement('div');row.className='source-evidence-upload'+(item.error?' has-error':'');
      const text=document.createElement('span');text.textContent=item.error?item.file.name+'：'+item.error.message:'正在保存图片：'+(item.file.name||'截图');row.append(text);
      if(item.error){row.setAttribute('role','alert');for(const [action,label]of [['retry','重试'],['dismiss','移除']]){const button=document.createElement('button');button.type='button';button.className='text-button';button.dataset.evidenceAction=action;button.dataset.uploadId=item.id;button.textContent=label;row.append(button);}}
      container.append(row);
    }
  }
  function renderImages(state){
    const container=state.wrapper.querySelector('[data-evidence-images]');container.replaceChildren();
    for(const image of state.images){
      const card=document.createElement('figure');card.className='source-evidence-image';card.setAttribute('role','listitem');
      const data=state.loaded.get(image.id),url=state.urls.get(image.id);
      if(url){
        const anchor=document.createElement('a'),img=document.createElement('img');anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';img.src=url;img.alt=image.name;img.loading='lazy';
        img.onerror=()=>{if(!alive(state)||state.urls.get(image.id)!==url)return;URL.revokeObjectURL(url);state.urls.delete(image.id);state.loaded.set(image.id,{error:true});renderImages(state);};
        anchor.append(img);card.append(anchor);
      }
      else{const status=document.createElement('div');status.className='source-evidence-image-status';status.textContent=data?.error?'图片暂不可用，原引用已保留':'正在读取图片…';card.append(status);}
      const caption=document.createElement('figcaption'),name=document.createElement('span');name.textContent=image.name;caption.append(name);
      if(!state.readonly){const button=document.createElement('button');button.type='button';button.className='text-button';button.dataset.evidenceAction='remove';button.dataset.imageId=image.id;button.setAttribute('aria-label','移除图片 '+image.name);button.textContent='移除';caption.append(button);}card.append(caption);container.append(card);
    }
  }
  async function loadImage(state,reference){
    if(state.loaded.has(reference.id))return;
    state.loaded.set(reference.id,{loading:true});
    try{
      const record=await window.LubanAttachmentStore.get(reference.id);
      if(!alive(state))return;
      if(!state.images.some(x=>x.id===reference.id))return;
      if(!record?.blob||!['image/png','image/jpeg','image/webp'].includes(record.blob.type)){state.loaded.set(reference.id,{error:true});renderImages(state);return;}
      state.urls.set(reference.id,URL.createObjectURL(record.blob));state.loaded.set(reference.id,{loaded:true});
    }catch(error){if(!alive(state))return;state.loaded.set(reference.id,{error:true});}
    if(alive(state))renderImages(state);
  }
  function upload(state,file,event,item=null){
    const entry=item||{id:crypto.randomUUID(),file,error:null};entry.error=null;state.uploads.set(entry.id,entry);
    const dialog=state.wrapper.closest('dialog');let promise;
    promise=Promise.resolve().then(()=>window.LubanAttachmentStore.put(file)).then(reference=>{
      if(!contextAlive(state,dialog))return;
      state.images.push(...refs([reference]));state.wrapper.dataset.sourceImages=JSON.stringify(state.images);state.uploads.delete(entry.id);
      renderImages(state);loadImage(state,reference);changed(state,event);
    }).catch(error=>{
      if(!contextAlive(state,dialog))return;
      entry.error=error instanceof Error?error:new Error('图片未能保存，请重试。');notify(state,entry.error);
    }).finally(()=>{
      state.pending.delete(promise);if(alive(state))renderUploads(state);
    });
    state.pending.add(promise);renderUploads(state);changed(state,event,{pending:true});return promise;
  }
  function bind(root,callbacks={}){
    let known=roots.get(root);if(!known){known=new Set();roots.set(root,known);}
    for(const state of known){if(state.disposed)known.delete(state);else if(!root.contains(state.wrapper)){dispose(state.wrapper);known.delete(state);}}
    for(const wrapper of wrappers(root)){
      let state=states.get(wrapper);if(state){state.callbacks=callbacks;known.add(state);continue;}
      const value=initial(wrapper);state={wrapper,images:value.images,readonly:wrapper.dataset.sourceReadonly==='true',callbacks,pending:new Set(),uploads:new Map(),loaded:new Map(),urls:new Map(),listeners:[],disposed:false};states.set(wrapper,state);known.add(state);
      const listen=(name,handler,capture=false)=>{wrapper.addEventListener(name,handler,capture);state.listeners.push([name,handler,capture]);};
      state.unbindRich=window.LubanRichEditor.bind(wrapper,{onChange:({event})=>{if(!state.readonly)exposeLinks(wrapper.querySelector('[data-rich-surface]'));changed(state,event);},onSave:({event})=>{if(alive(state))state.callbacks.onSave?.(payload(state,event));}});
      listen('click',event=>{
        const button=event.target.closest('[data-evidence-action]');if(!button||state.readonly)return;event.preventDefault();event.stopPropagation();
        const action=button.dataset.evidenceAction;
        if(action==='choose')wrapper.querySelector('[data-source-file]').click();
        if(action==='remove'){
          state.images=state.images.filter(image=>image.id!==button.dataset.imageId);wrapper.dataset.sourceImages=JSON.stringify(state.images);
          const url=state.urls.get(button.dataset.imageId);if(url)URL.revokeObjectURL(url);state.urls.delete(button.dataset.imageId);renderImages(state);changed(state,event);
        }
        const entry=state.uploads.get(button.dataset.uploadId);
        if(entry&&action==='retry')upload(state,entry.file,event,entry);
        if(entry&&action==='dismiss'){state.uploads.delete(entry.id);renderUploads(state);changed(state,event);}
      });
      listen('change',event=>{if(!event.target.matches('[data-source-file]')||state.readonly)return;for(const file of event.target.files||[])upload(state,file,event);event.target.value='';});
      listen('paste',event=>{
        if(state.readonly||!event.target.matches('[data-rich-surface]'))return;
        const clipboard=event.clipboardData;if(!clipboard)return;
        const files=[...clipboard.files||[]];
        for(const file of files)upload(state,file,event);
        if(files.length)event.preventDefault();
        else if(/<img\b/i.test(clipboard.getData('text/html'))){
          const error=new Error('外链图片未添加；文字和链接已保留，请另存图片后使用“添加图片”。');wrapper.querySelector('[data-evidence-notice]').textContent=error.message;notify(state,error);
        }
        // The nested rich editor keeps the safe text and links from this same paste.
      },true);
      renderImages(state);renderUploads(state);for(const image of state.images)loadImage(state,image);
    }
    return ()=>dispose(root);
  }
  function read(node){
    const wrapper=wrappers(node)[0];if(!wrapper)return {html:'',text:'',images:[],links:[]};
    const state=states.get(wrapper);if(!state)return initial(wrapper);
    if(state.pending.size)throw new Error('图片正在保存，请稍候再保存表单。');
    if([...state.uploads.values()].some(x=>x.error))throw new Error('有图片未保存，请重试或移除失败项后再保存表单。');
    return snapshot(state);
  }
  async function flush(node){
    for(const wrapper of wrappers(node)){
      const state=states.get(wrapper);if(!state)continue;
      while(state.pending.size)await Promise.all([...state.pending]);
      if(!alive(state)||wrapper.closest('dialog')&&!wrapper.closest('dialog').open)throw new Error('当前来源明细已关闭，请重新打开后保存。');
      const failed=[...state.uploads.values()].find(x=>x.error);if(failed)throw failed.error;
    }
  }
  function dispose(node){
    for(const wrapper of wrappers(node)){
      const state=states.get(wrapper);if(!state)continue;state.disposed=true;state.unbindRich?.();
      for(const [name,handler,capture]of state.listeners)wrapper.removeEventListener(name,handler,capture);
      for(const url of state.urls.values())URL.revokeObjectURL(url);state.urls.clear();states.delete(wrapper);
    }
    roots.delete(node);
  }
  return {markup,bind,read,flush,dispose};
})();
