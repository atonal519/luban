/* A preview owns an exact visible scope; applying it never follows package links. */
(() => {
  const P=window.LubanPlanning,D=window.LubanDateLinks;
  const snapshot=(records,rules,editableIds)=>JSON.stringify({records,rules:P.normalizeRules(rules),editableIds:[...editableIds].sort()});
  const reasons={research:'研究任务不使用发布排期',ended:'已结束',permission:'无编辑权限','no-anchor':'没有起算计划','no-rules':'尚未设置排期间隔',complete:'计划日期已齐全',unconnected:'空白阶段之间的间隔未设置','invalid-date':'计划日期无法识别'};
  function preview(records,rules,editableIds){
    const normalized=P.normalizeRules(rules),editable=new Set(editableIds),changes=[],skipped=[];
    for(const r of records){
      const values=P.nodes.map(n=>D.get(r,n.path)),anchor=P.nodes.find(n=>D.get(r,n.path))?.path;
      let reason='';
      if(r.workflow?.kind==='research')reason='research';
      else if([8,9,14].includes(r.stage))reason='ended';
      else if(!editable.has(r.id))reason='permission';
      else if(values.every(Boolean))reason='complete';
      else if(!anchor)reason='no-anchor';
      else if(normalized.gaps.every(gap=>gap===null))reason='no-rules';
      let updates=[];
      if(!reason){try{updates=P.planUpdates(r,normalized,anchor);}catch{reason='invalid-date';}if(!reason&&!updates.length)reason='unconnected';}
      if(reason)skipped.push({id:r.id,title:r.title,reason});
      else changes.push({id:r.id,title:r.title,version:r.version||'',anchor,before:structuredClone(r),values,updates});
    }
    return {signature:snapshot(records,normalized,editableIds),rules:normalized,total:records.length,changes,skipped,dateCount:changes.reduce((n,row)=>n+row.updates.length,0)};
  }
  function matches(result,records,rules,editableIds){return result.signature===snapshot(records,rules,editableIds);}
  function apply(records,result){
    const byId=new Map(records.map(r=>[r.id,r])),patches=new Map();
    for(const row of result.changes){
      const current=byId.get(row.id);
      if(!current||JSON.stringify(current)!==JSON.stringify(row.before))throw new Error('数据已变化，请重新预览。');
      const next=structuredClone(current);
      for(const update of row.updates){
        if(D.get(next,update.path))throw new Error('日期已填写，请重新预览。');
        D.edit(next,update.path,update.value);next.dateLinks[update.path]={mode:'calculated',anchor:row.anchor};
      }
      patches.set(row.id,next);
    }
    return records.map(r=>patches.get(r.id)||structuredClone(r));
  }
  window.LubanPlanningBatch={preview,matches,apply,reasons};
})();
