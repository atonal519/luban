/* Browser-local image blobs stay outside the application's JSON snapshots. */
window.LubanAttachmentStore=(()=>{
  const MAX_IMAGE_BYTES=10*1024*1024,MIME=new Set(['image/png','image/jpeg','image/webp']);
  let opening=null;
  function failure(message,code,cause){const error=new Error(message);error.code=code;if(cause)error.cause=cause;return error;}
  function normalize(error){
    if(error?.code?.startsWith?.('attachment-'))return error;
    if(error?.name==='QuotaExceededError')return failure('图片存储空间不足，请清理浏览器空间后重试；当前文字和已保存图片会保留。','attachment-quota',error);
    return failure('图片未能保存，请重试；当前文字和已保存图片会保留。','attachment-storage',error);
  }
  function database(){
    if(opening)return opening;
    opening=new Promise((resolve,reject)=>{
      let request,settled=false;
      try{request=indexedDB.open('luban-attachments-v1',1);}catch(error){reject(normalize(error));return;}
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('images'))request.result.createObjectStore('images',{keyPath:'id'});};
      request.onerror=()=>{settled=true;reject(normalize(request.error));};
      request.onblocked=()=>{settled=true;reject(failure('图片存储暂被其他页面占用，请关闭旧页面后重试。','attachment-blocked'));};
      request.onsuccess=()=>{
        const db=request.result;if(settled){db.close();return;}
        db.onversionchange=()=>{db.close();opening=null;};resolve(db);
      };
    }).catch(error=>{opening=null;throw error;});
    return opening;
  }
  async function dimensions(blob){
    if(typeof createImageBitmap==='function'){
      const bitmap=await createImageBitmap(blob);const size={width:bitmap.width,height:bitmap.height};bitmap.close();return size;
    }
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob),image=new Image();
      image.onload=()=>{URL.revokeObjectURL(url);resolve({width:image.naturalWidth,height:image.naturalHeight});};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(failure('这张图片无法读取，请重新选择 PNG、JPEG 或 WebP 图片。','attachment-invalid'));};
      image.src=url;
    });
  }
  async function validate(blob){
    if(!(blob instanceof Blob)||!MIME.has(blob.type))throw failure('只支持 PNG、JPEG 或 WebP 图片，暂不支持 SVG 等文件。','attachment-type');
    if(!blob.size)throw failure('图片是空文件，请重新选择。','attachment-empty');
    if(blob.size>MAX_IMAGE_BYTES)throw failure('单张图片不能超过 10 MB，请选择较小的图片。','attachment-size');
    const bytes=new Uint8Array(await blob.slice(0,16).arrayBuffer());
    const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
    const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!(blob.type==='image/png'&&png||blob.type==='image/jpeg'&&jpeg||blob.type==='image/webp'&&webp))throw failure('图片内容与文件类型不符，请重新选择。','attachment-invalid');
    try{return await dimensions(blob);}catch(error){throw error?.code?error:failure('这张图片无法读取，请重新选择。','attachment-invalid',error);}
  }
  const reference=record=>({id:record.id,name:record.name,mime:record.mime,size:record.size,width:record.width,height:record.height});
  async function put(blob){
    const size=await validate(blob),db=await database();
    const suffix={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[blob.type];
    const record={id:'ATT-'+crypto.randomUUID(),name:String(blob.name||'截图.'+suffix).replace(/[\u0000-\u001f]/g,' ').trim()||'截图.'+suffix,mime:blob.type,size:blob.size,...size,blob};
    await new Promise((resolve,reject)=>{
      let tx,requestError;
      try{tx=db.transaction('images','readwrite');const request=tx.objectStore('images').put(record);request.onerror=()=>requestError=request.error;}catch(error){reject(normalize(error));return;}
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(normalize(tx.error||requestError));tx.onabort=()=>reject(normalize(tx.error||requestError));
    });
    return reference(record);
  }
  async function get(id){
    const db=await database();
    return new Promise((resolve,reject)=>{
      let tx,request,result;
      try{tx=db.transaction('images','readonly');request=tx.objectStore('images').get(String(id));}catch(error){reject(normalize(error));return;}
      request.onsuccess=()=>result=request.result||null;
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(normalize(tx.error));tx.onabort=()=>reject(normalize(tx.error));
    });
  }
  return {put,get,MAX_IMAGE_BYTES};
})();
