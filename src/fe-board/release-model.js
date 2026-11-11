/* A release decision authorizes a phase; it does not record vehicle execution. */
(() => {
  const roles={rd:'研发准出',qa:'质量准出',domain:'领域负责人确认'};
  function context(p){
    return JSON.stringify(p.members.map(r=>[r.id,r.title,r.owner,r.version,r.productionPlans,r.documents,r.description,r.metric,
      ['single','group','gray','launch'].map(id=>window.LubanDateLinks?.material(r,'production.'+id+'.expectedEnd')||'')]));
  }
  function decision(p,phase){
    const saved=p.review?.decisions?.[phase];
    if(saved)return saved.context===context(p)?saved:null;
    // Prior versions explicitly logged the meeting decision while also advancing stage.
    const names={单车:'单车验证',编组:'编组验证',灰度:'灰度验证',上线:'上线阶段完成'};
    const event=(p.review?.events||[]).slice().reverse().find(x=>/^(管理员记录：|创建者模拟记录：|PM 记录：)现场会上口头同意，整包进入/.test(x.text)&&x.text.endsWith(names[phase]));
    return event?{phase,at:event.at,actor:event.actor,legacy:true}:null;
  }
  function blockers(p,review,actor){
    const reasons=[];
    if(decision(p,p.phase))reasons.push('本阶段已确认');
    if(!p.ready)reasons.push('包内 FE 尚未完成实验室准入');
    if(p.target===null)reasons.push('当前没有可确认的生产阶段');
    if(!['creator','pm'].includes(actor.kind))reasons.push('由 PM 记录现场同意并完成发布确认');
    const missing=Object.entries(roles).filter(([key])=>!review.signs?.[key]).map(([,name])=>name);
    if(missing.length)reasons.push('等待'+missing.join('、'));
    if(!review.signs?.field)reasons.push('请先记录现场口头同意');
    return reasons;
  }
  window.LubanReleaseModel={context,decision,blockers,roles};
})();
