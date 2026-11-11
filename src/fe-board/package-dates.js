/* Shared production facts: edit once, retain occurrence and recording times separately. */
(() => {
  const D=window.LubanDateLinks,W=window.LubanWorkflow,copy=x=>structuredClone(x);
  const paths={4:'production.single.actualStart',5:'production.group.actualStart',6:'production.gray.actualStart',8:'releaseConfirmedDate'};
  const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
  const applies=(r,stage)=>W.definition(r).kind==='release'&&W.definition(r).path.includes(stage);
  function members(records,r,stage){return r.version&&applies(r,stage)?records.filter(x=>x.version===r.version&&applies(x,stage)):[r];}
  function suggest(records,id,target,today){
    const r=records.find(x=>x.id===id);if(!r)return {value:today,conflict:false,source:'today'};
    const path=paths[target]||(target===1?'phase.development.actualStart':target===3?'phase.testing.actualStart':target===13?'researchDates.actualStart':target===14?'researchDates.actualEnd':'');
    const scope=paths[target]?members(records,r,target):[r],values=scope.map(x=>{
      if(!path)return '';if(target===3&&x.dateLinks?.[path]?.mode==='source-fact')return '';
      if(D.isAuto(x,path))return '';return path.startsWith('researchDates.')?x.researchDates?.[path.split('.')[1]]||'':D.get(x,path);
    }).filter(Boolean),dates=[...new Set(values)];
    if(dates.length>1||dates.some(d=>!valid(d)||d>today))return {value:'',conflict:true,source:'conflict',dates};
    return {value:dates[0]||today,conflict:false,source:dates.length?'recorded':'today',dates};
  }
  function sync(beforeRecords,afterRecords,id,ctx){
    const records=copy(afterRecords),r=records.find(x=>x.id===id),before=beforeRecords.find(x=>x.id===id);
    if(!r||!before||W.definition(r).kind==='research')return records;
    const edits=Object.entries(paths).filter(([,path])=>D.get(before,path)!==D.get(r,path)&&r.dateLinks?.[path]?.mode==='manual');
    if(!edits.length)return records;if(ctx.canEdit&& !ctx.canEdit(before))throw Error('请由所属 PM 或已授权人员更正实际日期');
    for(const [code,path] of edits){
      const stage=Number(code),value=D.get(r,path);if(value&&!valid(value))throw Error('实际日期无效');
      const scope=before.version===r.version?members(records,r,stage):[r],scopeIds=scope.map(x=>x.id);
      for(const x of scope){
        const old=beforeRecords.find(y=>y.id===x.id),oldValue=old?D.get(old,path):'';
        D.edit(x,path,value);
        if(x.stage===stage)x.entered=value;
        // Correct only the current round; earlier visits before a return stay intact.
        const visits=x.flowVisits||[],index=visits.findLastIndex(v=>v.to===stage&&v.version===(x.version||'')),visit=visits[index],order=W.definition(x).path;
        const returned=index>=0&&visits.slice(index+1).some(v=>order.indexOf(v.to)>=0&&order.indexOf(v.to)<order.indexOf(stage));
        if(visit&&!returned&&x.stage>=stage&&x.stage<=8&&visit.date!==value){
          const prior=visit.date||'',correction={before:prior,after:value,at:ctx.at,actor:ctx.actor.name,actorId:ctx.actor.id};
          visit.dateCorrections||=[];visit.dateCorrections.push(copy(correction));visit.date=value;
          const previous=({3:'phase.testing.actualEnd',4:'production.single.actualEnd',5:'production.group.actualEnd',6:'production.gray.actualEnd'})[visit.from];
          if(previous&&D.get(x,previous)===prior)D.edit(x,previous,value);
          const first=order.find(s=>[4,5,6].includes(s));
          if(stage===first&&D.get(x,'phase.production.actualStart')===prior)D.edit(x,'phase.production.actualStart',value);
          if(stage===8&&D.get(x,'phase.production.actualEnd')===prior)D.edit(x,'phase.production.actualEnd',value);
          const q=records.flatMap(y=>y.flowRequests||[]).find(q=>q.id===visit.requestId&&q.status==='completed');
          if(q&&q.actualDate===prior){q.dateCorrections||=[];q.dateCorrections.push(copy(correction));q.actualDate=value;}
        }
        if(oldValue!==value){x.updated=ctx.at;x.history||=[];x.history.push({at:ctx.at,actor:ctx.actor.name,actorId:ctx.actor.id,kind:'change',reason:ctx.reason||'核对实际发生日期',text:(scope.length>1?'同包':'')+D.label(path)+'已更正',items:[{label:D.label(path),before:oldValue,after:value}],packageDateCorrection:{version:x.version||'',stage,scopeIds,editedFE:id}});}
      }
    }
    return records;
  }
  window.LubanPackageDates={paths,members,suggest,sync};
})();
