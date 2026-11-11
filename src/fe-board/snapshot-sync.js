/* Replace obsolete test state with the confirmed workbook snapshot once. */
(() => {
  const copy = value => structuredClone(value);
  function mergeBaseRecord(incoming, prior, revision) {
    if (!prior) return copy(incoming);
    const next=copy(prior),kept=new Set(['pm','okrO','okrKR','entered','updated','history','rollbacks','gate','notes','documents','phaseDates','productionDates','dateLinks']);
    Object.entries(incoming).forEach(([key,value])=>{if(!kept.has(key))next[key]=copy(value);});
    next.documents=[...new Map([...(incoming.documents||[]),...(prior.documents||[])].map(d=>[d.url,d])).values()];
    next.phaseDates||={};next.dateLinks||={};
    Object.entries(incoming.phaseDates||{}).forEach(([phase,dates])=>{
      if(phase==='demand')return;
      next.phaseDates[phase]||={};
      for(const field of ['expectedStart','expectedEnd'])if(Object.hasOwn(dates,field)){
        next.phaseDates[phase][field]=dates[field];
        next.dateLinks['phase.'+phase+'.'+field]={mode:'source',revision};
      }
    });
    Object.keys(incoming.productionPlans||{}).forEach(phase=>{next.dateLinks['plan.'+phase]={mode:'source',revision};});
    if(incoming.stage!==prior.stage){
      // Preserve the old stage's dated fact before clearing the current-stage
      // timestamp; the table supplies no actual entry date for the new stage.
      if(prior.entered&&Number.isFinite(Date.parse(prior.entered))){
        const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(prior.entered));
        const phase=({1:'development',3:'testing'})[prior.stage],production=({4:'单车',5:'编组',6:'灰度',8:'上线'})[prior.stage];
        const field=prior.stage===8?'actualEnd':'actualStart';
        if(phase){next.phaseDates[phase]||={};next.phaseDates[phase][field]||=day;}
        if(production){next.productionDates||={};next.productionDates[production]||={};next.productionDates[production][field]||=day;}
      }
      next.entered='';
    }
    next.sourceDateConflicts=[];
    Object.entries(incoming.sourceActualDates||{}).forEach(([path,day])=>{
      const [type,id,field]=path.split('.'),name=({single:'单车',group:'编组',gray:'灰度'})[id];
      if(type!=='phase'&&type!=='production'||type==='phase'&&id!=='testing'||type==='production'&&!name||field!=='actualStart')return;
      const target=type==='phase'?(next.phaseDates[id]||={}):((next.productionDates||={})[name]||={}),priorValue=target[field]||'';
      if(next.dateLinks[path]?.mode==='manual'&&priorValue!==day){next.sourceDateConflicts.push({path,source:day,local:priorValue});return;}
      target[field]=day;next.dateLinks[path]={mode:'source-fact',revision};
    });
    return next;
  }
  function mergeBaseSnapshot(data,current,result,baselineIds) {
    const prior=new Map(current.records.map(r=>[r.id,r])),ids=new Set(data.records.map(r=>r.id));
    const completed=new Set(data.refresh?.completedIds||[]),allOld=[...current.records,...(current.archivedRecords||[])];
    if(data.refresh?.removeCompleted)allOld.forEach(r=>{if(r.sourceStatus==='全车'&&!ids.has(r.id))completed.add(r.id);});
    const purge=r=>data.refresh?.removeCompleted&&!ids.has(r.id)&&completed.has(r.id);
    const versions=new Set(data.records.map(r=>r.version).filter(Boolean)),completedVersions=new Set(data.refresh?.completedVersions||[]);
    if(data.refresh?.removeCompleted)allOld.filter(purge).forEach(r=>{if(r.version&&!versions.has(r.version))completedVersions.add(r.version);});
    const manual=current.records.filter(r=>!ids.has(r.id)&&!r.sourceRevision&&!baselineIds.has(r.id)&&!purge(r));
    const removed=current.records.filter(r=>!ids.has(r.id)&&!manual.includes(r)&&!purge(r));
    const journalKey=x=>JSON.stringify([x.type,x.key,x.date]),incoming=new Set((data.dailyUpdates||[]).map(journalKey));
    const dailyUpdates=copy(current.dailyUpdates||[]).filter(x=>!(data.refresh?.removeCompleted&&(x.type==='fe'&&completed.has(x.key)||x.type==='package'&&completedVersions.has(x.key)))&&!(data.refresh?.replaceImportedProgress&&x.origin==='workbook'&&incoming.has(journalKey(x))));
    const known=new Set(dailyUpdates.filter(x=>x.origin==='workbook').map(journalKey));
    (data.dailyUpdates||[]).forEach(x=>{if(!known.has(journalKey(x))){dailyUpdates.push(copy(x));known.add(journalKey(x));}});
    return {...result,records:[...data.records.map(r=>mergeBaseRecord(r,prior.get(r.id),data.sourceRevision)),...copy(manual)],
      dailyUpdates,packageReviews:Object.fromEntries(Object.entries(copy(current.packageReviews||{})).filter(([version])=>!data.refresh?.removeCompleted||!completedVersions.has(version))),
      archivedRecords:[...new Map([...(current.archivedRecords||[]),...removed].filter(r=>!purge(r)).map(r=>[r.id,copy(r)])).values()],
      sourceRevision:data.sourceRevision,changed:true};
  }
  function refresh(data, stored, backup) {
    const repair=data.refresh?.restoreFromBackup;
    if(stored&&backup&&repair?.revision===stored.sourceRevision){
      stored=copy(stored);const existing=new Set([...stored.records,...(stored.archivedRecords||[])].map(r=>r.id)),wanted=new Set(repair.recordIds||[]);
      const recovered=[...(backup.records||[]),...(backup.archivedRecords||[])].filter(r=>wanted.has(r.id)&&!existing.has(r.id));
      stored.archivedRecords=[...(stored.archivedRecords||[]),...copy(recovered)];
      const journalIds=new Set((stored.dailyUpdates||[]).map(x=>x.id));
      stored.dailyUpdates=[...(stored.dailyUpdates||[]),...copy((backup.dailyUpdates||[]).filter(x=>x.type==='fe'&&wanted.has(x.key)&&!journalIds.has(x.id)))];
      stored.packageReviews||={};for(const r of recovered)if(r.version&&backup.packageReviews?.[r.version]&&!stored.packageReviews[r.version])stored.packageReviews[r.version]=copy(backup.packageReviews[r.version]);
    }
    const current = stored || {version:3,records:copy(data.records),dailyUpdates:copy(data.dailyUpdates || []),packageReviews:{}};
    const result = {...copy(current),changed:false};
    if (!stored || !data.sourceRevision || stored.sourceRevision === data.sourceRevision) return result;
    const baselineIds = new Set((data.refresh?.baseline || []).map(r => r.id));
    const legacySource = stored.records.some(r => baselineIds.has(r.id) && r.sourceRevision !== data.sourceRevision);
    const legacyManualOnly = stored.dataset === data.id && stored.records.every(r => !r.sourceRevision);
    if (!legacySource && !legacyManualOnly) return result;
    if(data.refresh?.mode==='base-fields')return mergeBaseSnapshot(data,current,result,baselineIds);
    const manualProgress = data.refresh?.preserveProgress ? (stored.dailyUpdates || []).filter(x => x.origin !== 'workbook') : [];
    return {...result,records:copy(data.records),dailyUpdates:[...copy(manualProgress),...copy(data.dailyUpdates || [])],packageReviews:{},archivedRecords:[],sourceRevision:data.sourceRevision,changed:true};
  }
  window.LubanSnapshotSync = {refresh};
})();
