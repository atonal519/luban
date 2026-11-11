(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DATA = window.LUBAN_DATASET;
  const dateLinks = window.LubanDateLinks, planning=window.LubanPlanning, pmDirectory=window.LubanPMDirectory;
  const STORAGE = 'luban-' + DATA.id + '-v1';
  const FLOW=window.LubanWorkflow;
  let reportingUI,reportingData=window.LubanReporting.initial(),intakeUI,intakeData=window.LubanIntake.initial(),flowUI, bookUI, tableViews, fieldAdapter, planningUI, planningBatchUI, packageReviews = {}, dailyUpdates=[], archivedRecords=[], appliedSourceRevision=DATA.sourceRevision, planningRules=planning.normalizeRules({}), planningRuleHistory=[];
  const PREFS = STORAGE + '-columns';
  const GROUP_PREFS=STORAGE+'-grouping', viewModel=window.LubanTableViewModel;
  const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const MODULES = [...new Set([...DATA.modules,...(DATA.ratSource?.participantModules||[])])];
  const TOPICS = DATA.topics;
  const PHASES = [{ id: 'demand', name: '需求' }, { id: 'development', name: '开发' }, { id: 'testing', name: '测试' }, { id: 'production', name: '生产' }];
  const DATE_FIELDS = [{ id: 'expectedStart', name: '预期开始时间' }, { id: 'expectedEnd', name: '预期结束时间' }, { id: 'actualStart', name: '实际开始时间' }, { id: 'actualEnd', name: '实际结束时间' }];
  const ACTORS = [{ id: 'creator', name: '系统管理员', kind: 'creator' }].concat(DATA.modules.map((name, i) => ({ id: 'pm-' + i, name: pmDirectory.roster[name] || name + ' PM', kind: 'pm', module: name })),[
    { id: 'rd', name: '研发负责人', kind: 'rd' },
    { id: 'qa', name: '质量负责人', kind: 'qa' }, {id:'domain',name:'领域负责人',kind:'domain'}
  ]);
  const STATES = [
    { label: '待开发', next: '开始开发', tone: 'neutral' },
    { label: '开发中', next: '进入自测', tone: 'blue' },
    { label: '自测中', next: '提测准入', tone: 'blue' },
    { label: '实验室测试', next: '实验室准出', tone: 'violet' },
    { label: FLOW.label(4), next: '单车准出', tone: 'cyan' },
    { label: FLOW.label(5), next: '编组准出', tone: 'cyan' },
    { label: FLOW.label(6), next: '灰度准出', tone: 'teal' },
    { label: '上线确认', next: '确认上线', tone: 'amber' },
    { label: '上线确认完成', next: '', tone: 'green' },
    {label:'中止',next:'',tone:'neutral'}, {label:'方案',next:'',tone:'neutral'}, {label:'待补充',next:'',tone:'neutral'}, {label:'未开始',next:'开始研究',tone:'neutral'}, {label:'研究中',next:'结束研究',tone:'blue'}, {label:'已结束',next:'',tone:'green'}
  ];
  const COLUMNS = [
    { id: 'title', name: '项目（FE）', width: 220, fixed: true, base: true },
    { id: 'package', name: '包名', width: 130, base: true },
    { id: 'priority', name: '优先级', width: 62, base: true },
    { id: 'topic', name: '所属专项', width: 78, base: true },
    { id: 'module', name: '所属模块', width: 96, base: true },
    { id: 'owner', name: '研发负责人', width: 90, base: true },
    { id: 'pm', name: '所属 PM', width: 82, base: true },
    { id: 'status', name: '当前阶段', width: 118, fixed: true, base: true },
    ...[{id:'development',name:'开发'},{id:'testing',name:'测试'},{id:'single',name:'单车'},{id:'group',name:'编组'},{id:'gray',name:'灰度'},{id:'launch',name:'上线'}].map(p=>({id:'schedule-'+p.id,name:p.name,width:100,period:p.id}))
  ];
  const PERIODS = [
    {id:'demand',name:'需求',phase:'demand'}, {id:'development',name:'开发',phase:'development'}, {id:'testing',name:'测试',phase:'testing'},
    {id:'single',name:'单车'}, {id:'group',name:'编组'}, {id:'gray',name:'灰度'}, {id:'launch',name:'上线'}
  ];
  const ENTRY_PERIODS=PERIODS.filter(p=>p.id!=='demand');
  const entryPath=(p,actual=false)=>p.phase?'phase.'+p.phase+'.'+(actual?'actualStart':'expectedStart'):actual?(p.id==='launch'?'releaseConfirmedDate':'production.'+p.id+'.actualStart'):'plan.'+p.name;
  const activePeriod = r => ({0:0,1:1,2:1,3:2,4:3,5:4,6:5,7:6,10:0})[r.stage] ?? -1;
  const dayDiff = (later,earlier) => later&&earlier ? Math.max(0,Math.round((Date.parse(later)-Date.parse(earlier))/86400000)) : 0;
  const localDate = s => !s?'':/^\d{4}-\d{2}-\d{2}$/.test(s)?s:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
  function eResearch(r,p){return p.name+' '+(p.start?date(p.start):'计划未填');}
  function schedule(r) {
    if(FLOW.definition(r).kind==='research')return [{id:'development',name:'开始',start:r.researchDates?.plannedStart||'',end:'',actualStart:r.researchDates?.actualStart||'',actualEnd:'',state:r.stage===12?'future':r.stage===13?'current':'past',overdue:r.stage===13?dayDiff(TODAY,r.researchDates?.plannedEnd):0,waitingLate:r.stage===12?dayDiff(TODAY,r.researchDates?.plannedStart):0,next:{name:'结束'},nextEntry:r.researchDates?.plannedEnd||''},{id:'testing',name:'结束',start:r.researchDates?.plannedEnd||'',end:'',actualStart:r.researchDates?.actualEnd||'',actualEnd:'',state:r.stage===14?'completed':'future',terminal:true,nextEntry:''}];
    const active=activePeriod(r);
    const path=FLOW.definition(r).path;
    const enabled=PERIODS.filter(p=>!r.workflow||p.id==='demand'||(p.id==='development'?path.some(s=>s===1||s===2):path.includes({testing:3,single:4,group:5,gray:6,launch:8}[p.id])));
    return enabled.map((p,i)=>{
      const fields=(p.phase?r.phaseDates[p.phase]:r.productionDates[p.name])||{};
      const start=dateLinks.get(r,entryPath(p));
      const end=fields.expectedEnd;
      const terminal=p.id==='launch';
      const canonicalIndex=PERIODS.findIndex(original=>original.id===p.id);
      const state=r.stage===8?(terminal?'completed':'past'):active>=0&&canonicalIndex<active?'past':active===canonicalIndex?'current':active>=0?'future':'unknown';
      const actualStart=dateLinks.get(r,entryPath(p,true))||(!p.phase&&state==='current'?localDate(r.entered):'');
      const actualEnd=terminal?(r.releaseConfirmedDate||''):fields.actualEnd;
      const next=enabled[i+1],nextEntry=next?dateLinks.get(r,entryPath(next)):'';
      const invalid=!!(start&&nextEntry&&start>nextEntry);
      return {...p,start,end,actualStart,actualEnd,state,terminal,invalid,next,nextEntry,lateStart:invalid?0:dayDiff(actualStart,start),overdue:!invalid&&state==='current'?dayDiff(TODAY,nextEntry):0,waitingLate:!invalid&&state==='future'?dayDiff(TODAY,start):0};
    });
  }
  function stageCell(r,p){return window.LubanStageCells.present(records,r,p,TODAY);}
  function periodMarkup(r,p) {
    const cell=stageCell(r,p),research=FLOW.definition(r).kind==='research';
    const sourceTest=p.id==='testing'&&r.dateLinks?.['phase.testing.actualStart']?.mode==='source-fact';
    const show=value=>value?(value.kind==='actual'?(sourceTest?'提测 ':'实际 '):'计划 ')+date(value.date):'';
    const primary=p.terminal&&!research&&r.stage===8?'上线确认完成'+(cell.primary.date?' '+date(cell.primary.date):''):cell.primary.date?show(cell.primary):cell.primary.kind==='actual'?'进入日期未填':p.state==='past'?'—':'计划未填';
    const secondary=cell.secondary?show(cell.secondary):'';
    const notices=[p.lateStart?(p.terminal&&!research?'晚'+p.lateStart+'天上线':'晚进'+p.lateStart+'天'):'',p.overdue?'下一阶段计划已过'+p.overdue+'天':'',p.waitingLate?(p.terminal&&!research?'待上线':'待进入')+' · +'+p.waitingLate+'天':''].filter(Boolean);
    const label=cell.status?cell.label:canEdit(r)?cell.action:'查看';
    const indicator=cell.status?'<button type="button" class="stage-flow-indicator" data-action="stage-workflow" data-id="'+esc(r.id)+'" data-status="'+cell.status+'" title="'+esc(p.name+' · '+cell.label)+'" aria-label="'+esc(r.title+' · 申请'+p.name+' · '+cell.label)+'"><i aria-hidden="true"></i><span>'+esc(label)+'</span></button>':cell.action?'<button type="button" class="stage-cell-action" data-action="stage-workflow" data-id="'+esc(r.id)+'" aria-label="'+esc(r.title+' · 今日计划'+p.name+' · '+label)+'">'+esc(label)+'</button>':'';
    return '<button type="button" class="period-plan" data-action="edit-dates" data-id="'+esc(r.id)+'" data-period-id="'+p.id+'" aria-label="'+esc(r.title+' '+p.name+'计划进入'+(p.start||'未填')+'，实际进入'+(p.actualStart||'未填')+'，查看或编辑日期')+'">'+esc(primary)+'</button>'+(secondary?'<span class="period-actual">'+esc(secondary)+'</span>':'')+(cell.today?'<span class="stage-today-label">今天</span>':'')+indicator+(notices.length?'<span class="period-notice '+(p.overdue||p.waitingLate?'danger':'')+'"'+(p.overdue?' title="'+esc('计划于'+p.nextEntry+'进入'+(p.next?.name||'下一阶段'))+'"':'')+'>'+esc(notices.join(' · '))+'</span>':'');
  }
  const ICONS = {
    layers:'<path d="m3 6 5-3 5 3-5 3-5-3Z"/><path d="m3 9 5 3 5-3M3 12l5 3 5-3"/>',
    briefcase:'<rect x="2" y="5" width="12" height="9" rx="2"/><path d="M6 5V3h4v2M2 9h12M7 8v2h2V8"/>',
    truck:'<path d="M1.5 4h8v7h-8zM9.5 7h3l2 2v2h-5"/><circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/>',
    headphones:'<path d="M2.5 9V7a5.5 5.5 0 0 1 11 0v2"/><rect x="1.5" y="8" width="3" height="5" rx="1"/><rect x="11.5" y="8" width="3" height="5" rx="1"/>',
    calendar:'<rect x="2" y="3" width="12" height="11" rx="2"/><path d="M5 1.5v3M11 1.5v3M2 7h12M5 10h2M9 10h2"/>',
    search:'<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/>',
    filter:'<path d="M2 3h12L9 9v4l-2-1V9L2 3Z"/>',
    sort:'<path d="M3 3v10m-2-2 2 2 2-2M8 4h6M8 8h4M8 12h2"/>',
    columns:'<rect x="2" y="2" width="12" height="12" rx="2"/><path d="M6 2v12M10 2v12"/>',
    plus:'<path d="M8 3v10M3 8h10"/>',
    download:'<path d="M8 2v8m-3-3 3 3 3-3M2 11v3h12v-3"/>',
    close:'<path d="m4 4 8 8M12 4l-8 8"/>',
    right:'<path d="m6 3 5 5-5 5"/>',
    left:'<path d="m10 3-5 5 5 5"/>',
    file:'<path d="M9 1.5H3v13h10v-9L9 1.5Z"/><path d="M9 1.5v4h4M5 8h6M5 11h4"/>',
    link:'<path d="m6 10 4-4M5 6l-2 2a3 3 0 0 0 4 4l2-2M7 6l2-2a3 3 0 0 1 4 4l-2 2"/>',
    settings:'<circle cx="8" cy="8" r="2.5"/><path d="M6.5 1.5h3l.5 2 1.5.8 2-.5 1.5 2.6-1.4 1.5v1.7l1.4 1.5-1.5 2.6-2-.5-1.5.8-.5 2h-3l-.5-2-1.5-.8-2 .5-1.5-2.6L2.4 9V7.3L1 5.8l1.5-2.6 2 .5L6 2.9Z"/>',
    check:'<path d="m3 8 3 3 7-7"/>'
  };
  const icon = (name) => '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.file) + '</svg>';
  function fillIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const day = (n) => new Date(Date.UTC(2026,9,n,4)).toISOString().slice(0,10);
  const stamp = (d, h) => d + 'T' + String(h).padStart(2,'0') + ':30:00+08:00';
  const now = () => new Date().toISOString();
  function time(s) {
    if (!s) return '—';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
  }
  const date = (s) => s ? s.slice(5).replace('-', '/') : '待补充';
  function seed() { return structuredClone(DATA.records); }
  function normalizeRecord(record) {
    const r = structuredClone(record);
    if(r.stage===7)r.stage=8;
    const legacyPlans = r.plans || [];
    if (!Object.prototype.hasOwnProperty.call(r, 'launchDate')) r.launchDate = legacyPlans[8] || '';
    r.owner = r.owner || '';
    r.okrO = r.okrO || '';
    r.okrKR = r.okrKR || '';
    r.rollbacks = (r.rollbacks || []).map(x=>({stage:'',version:'',...x}));
    r.documents = r.documents || [];
    r.kind=r.kind||'fe';r.leadModule=r.leadModule||'';r.productionPlans=r.productionPlans||{'单车':'','编组':'','灰度':'','上线':''};
    r.productionDates=r.productionDates||{};
    PERIODS.filter(p=>!p.phase).forEach(p=>{r.productionDates[p.name]={expectedEnd:'',actualStart:'',actualEnd:'',...(r.productionDates[p.name]||{})};});
    r.phaseDates = r.phaseDates || {};
    const legacyRanges = { development: [legacyPlans[1], legacyPlans[3]], testing: [legacyPlans[3], legacyPlans[4]], production: [legacyPlans[4], legacyPlans[8]] };
    PHASES.forEach(phase => {
      if (!r.phaseDates[phase.id]) {
        const range = legacyRanges[phase.id] || [];
        r.phaseDates[phase.id] = { expectedStart: range[0] || '', expectedEnd: range[1] || '', actualStart: '', actualEnd: '' };
      }
      DATE_FIELDS.forEach(field => { r.phaseDates[phase.id][field.id] = r.phaseDates[phase.id][field.id] || ''; });
    });
    const name=({4:'单车',5:'编组',6:'灰度'})[r.stage];
    const path=name?'production.'+({4:'single',5:'group',6:'gray'})[r.stage]+'.actualStart':r.stage===8?'production.launch.actualEnd':'';
    if(path&&r.entered&&!r.releaseConfirmedDate&&!dateLinks.get(r,path)&&r.dateLinks?.[path]?.mode!=='manual'){
      const [,,field]=path.split('.');r.productionDates[name||'上线'][field]=localDate(r.entered);r.dateLinks||={};r.dateLinks[path]={mode:'fact'};
    }
    const normalized=dateLinks.resolve(r);
    return r.id?pmDirectory.fill(normalized):normalized;
  }
  function load() {
    let stored, original;
    try { original=localStorage.getItem(STORAGE); stored=JSON.parse(original); } catch {}
    if (stored && [1,2,3].includes(stored.version) && Array.isArray(stored.records) && stored.records.every(r=>r.id&&Number.isInteger(r.stage)&&r.stage>=0&&r.stage<STATES.length)) {
      let restoreBackup;const repair=DATA.refresh?.restoreFromBackup;
      if(repair?.revision===stored.sourceRevision)try{restoreBackup=JSON.parse(localStorage.getItem(STORAGE+'-before-'+repair.revision.slice(0,12)));}catch{}
      let state=window.LubanSnapshotSync.refresh(DATA,stored,restoreBackup);
      if(state.changed){
        const next={...state,version:3,dataset:DATA.id,records:state.records.map(normalizeRecord)};delete next.changed;
        try {
          const backup=STORAGE+'-before-'+DATA.sourceRevision.slice(0,12);
          if(!localStorage.getItem(backup))localStorage.setItem(backup,original);
          localStorage.setItem(STORAGE,JSON.stringify(next));
        } catch {
          state=stored;
          appliedSourceRevision=stored.sourceRevision||'';
          setTimeout(()=>toast('底表刷新未能保存，旧数据已保留。请释放浏览器存储后重试。',true),0);
        }
      }
      intakeData=window.LubanIntake.normalize(state.intake);reportingData=window.LubanReporting.normalize(state.reporting);
      packageReviews=state.packageReviews||{};dailyUpdates=state.dailyUpdates||[];archivedRecords=state.archivedRecords||[];
      try{planningRules=planning.normalizeRules(state.planningRules);}catch{planningRules=planning.normalizeRules({});}
      planningRuleHistory=Array.isArray(state.planningRuleHistory)?structuredClone(state.planningRuleHistory):[];
      const normalized=state.records.map(normalizeRecord);
      if(!state.changed&&appliedSourceRevision===DATA.sourceRevision&&normalized.some((r,i)=>r.pm!==state.records[i].pm)){
        try{
          const backup=STORAGE+'-before-pm-defaults-20261026';if(!localStorage.getItem(backup))localStorage.setItem(backup,JSON.stringify(state));
          localStorage.setItem(STORAGE,JSON.stringify({...state,records:normalized}));
        }catch{setTimeout(()=>toast('PM 默认值未能保存，已有数据保留，刷新后可重试。',true),0);}
      }
      return normalized;
    }
    dailyUpdates=structuredClone(DATA.dailyUpdates||[]);archivedRecords=structuredClone(DATA.archivedRecords||[]);
    return seed().map(normalizeRecord);
  }
  let records=load(), actor=ACTORS[0], view='all', selected=null, drawerMode='view', detailTab='basic', dirty=false, progressEditing=false, toastTimer,dateDraft=null,lastPlanAnchor='',pmEdited=false,newWorkflowKind='release';
  let knownStoredState;try{knownStoredState=localStorage.getItem(STORAGE);}catch{}
  const searchOpened=new Set();
  const isDone = r => r.stage===8||r.stage===14;
  const overdue = r => !isDone(r) && FLOW.definition(r).kind!=='research' && r.launchDate && r.launchDate<TODAY ? Math.round((Date.parse(TODAY)-Date.parse(r.launchDate))/86400000) : 0;
  const attention = r => !isDone(r) && r.stage!==9 && (r.risk==='有' || overdue(r)>0 || schedule(r).some(p=>p.id!=='demand'&&(p.overdue||p.waitingLate)) || r.gate.pending || (FLOW.definition(r).kind!=='research'&&!r.launchDate) || !!r.gate.rejection);
  const mine = r => actor.kind==='creator' || (actor.kind==='pm' ? r.pm===actor.id||r.pm===actor.name : actor.kind==='rd' ? r.stage===2 && !r.gate.rd : r.stage>=2 && r.stage<8 && !(r.stage===2&&r.gate.qa));
  const canEdit = r => actor.kind==='creator' || actor.kind==='pm'&&(r.pm===actor.id||r.pm===actor.name) || !r.pm&&r.createdBy===actor.id;
  const getRecord = () => records.find(r=>r.id===selected);
  function toast(message,error=false) { const el=$('toast'); el.textContent=message; el.className='toast visible'+(error?' error':''); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.className='toast',3300); }
  function save(next, nextReviews = packageReviews, nextDaily = dailyUpdates, nextSourceRevision = appliedSourceRevision, nextRules = planningRules, nextIntake = intakeData, nextReporting = reportingData) {
    const rulesChanged=JSON.stringify(nextRules)!==JSON.stringify(planningRules);
    const nextRuleHistory=rulesChanged?[...planningRuleHistory,{at:now(),actorId:actor.id,actor:actor.name,before:structuredClone(planningRules),after:structuredClone(nextRules)}]:planningRuleHistory;
    let serialized;
    try { assertPlanningStateCurrent();serialized=JSON.stringify({version:3,dataset:DATA.id,sourceRevision:nextSourceRevision,records:next,packageReviews:nextReviews,dailyUpdates:nextDaily,archivedRecords,planningRules:nextRules,planningRuleHistory:nextRuleHistory,intake:nextIntake,reporting:nextReporting});
      const hasWorkflow=next.some(r=>r.workflow||(r.flowVisits||[]).length||(r.flowRequests||[]).length||(r.packageLineage||[]).length);
      if(hasWorkflow&&!localStorage.getItem(STORAGE+'-before-workflow-20261027'))localStorage.setItem(STORAGE+'-before-workflow-20261027',localStorage.getItem(STORAGE)||JSON.stringify({version:3,dataset:DATA.id,sourceRevision:appliedSourceRevision,records,packageReviews,dailyUpdates,archivedRecords,planningRules,planningRuleHistory}));
      if((nextIntake.demands.length||nextIntake.tasks.length)&&!localStorage.getItem(STORAGE+'-before-demand-pool-20261102'))localStorage.setItem(STORAGE+'-before-demand-pool-20261102',localStorage.getItem(STORAGE)||JSON.stringify({version:3,dataset:DATA.id,sourceRevision:appliedSourceRevision,records,packageReviews,dailyUpdates,archivedRecords,planningRules,planningRuleHistory,intake:intakeData}));
      if((nextReporting.submissions.length||nextReporting.changes.length||nextReporting.reports.length)&&!localStorage.getItem(STORAGE+'-before-reporting-20261103'))localStorage.setItem(STORAGE+'-before-reporting-20261103',localStorage.getItem(STORAGE)||JSON.stringify({version:3,dataset:DATA.id,sourceRevision:appliedSourceRevision,records,packageReviews,dailyUpdates,archivedRecords,planningRules,planningRuleHistory,intake:intakeData}));
      localStorage.setItem(STORAGE,serialized);
      if(hasWorkflow)try{localStorage.setItem(STORAGE+'-workflow-latest',serialized);}catch{}
    }
    catch (failure) {
      const message=failure.code==='stale-state'?failure.message:'未能保存。请检查浏览器存储后重试，当前输入已保留。';
      const error=$('planning-dialog')?.open?$('planning-dialog').querySelector('.planning-error'):$('planning-preview-dialog')?.open?$('planning-preview-error'):$('aux-workspace').querySelector('[data-planning-form]')?.querySelector('.planning-error')||($('package-dialog')?.open?$('package-error'):$('gate-dialog').open?$('gate-error'):$('quick-dialog').open?$('quick-error'):$('detail').open?$('form-error'):null);
      if(error){error.textContent=message;error.scrollIntoView({block:'nearest'});}
      toast(message,true); return false;
    }
    knownStoredState=serialized;reportingData=nextReporting;intakeData=nextIntake;records=next; packageReviews=nextReviews;dailyUpdates=nextDaily;appliedSourceRevision=nextSourceRevision;planningRules=nextRules;planningRuleHistory=nextRuleHistory; $('save-label').textContent='已保存'; render(); return true;
  }
  function update(id,apply) {
    const next=structuredClone(records), r=next.find(x=>x.id===id); if(!r) return false;
    const previousPlans=structuredClone(r.productionPlans),oldPlans=JSON.stringify(r.productionPlans),oldVersion=r.version,beforeRecord=structuredClone(r);apply(r);r.updated=now();
    if(oldVersion&&r.version!==oldVersion){r.packageLineage||=[];const snapshot=beforeRecord;delete snapshot.packageLineage;delete snapshot.flowRequests;delete snapshot.flowVisits;r.packageLineage.push({version:oldVersion,replacement:r.version,relation:'包号调整',at:now(),actor:actor.name,reason:'基本信息调整包号',snapshot});}
    if(r.version&&r.version===oldVersion&&JSON.stringify(r.productionPlans)!==oldPlans){
      next.filter(x=>x.id!==r.id&&x.version===r.version).forEach(x=>{
        const before=JSON.stringify(x.productionPlans);
        x.dateLinks||={};
        Object.keys(r.productionPlans).filter(phase=>r.productionPlans[phase]!==previousPlans[phase]).forEach(phase=>{
          const path='plan.'+phase,calculated=r.dateLinks?.[path]?.mode==='calculated';
          if(calculated&&x.productionPlans[phase])return;
          x.productionPlans[phase]=r.productionPlans[phase];x.dateLinks[path]={mode:calculated?'calculated':'manual'};
          if(phase==='上线')x.launchDate=r.productionPlans[phase];
        });
        dateLinks.resolve(x);
        if(before===JSON.stringify(x.productionPlans))return;
        x.history.push({at:now(),actor:actor.name,kind:'change',reason:r.history.at(-1)?.reason||'',text:'同包生产计划已更新',items:[{label:'生产计划进入时间',before,after:JSON.stringify(x.productionPlans)}]});
      });
    }
    try{return save(window.LubanPackageDates.sync(records,next,id,{actor,at:now(),canEdit,reason:r.history.at(-1)?.reason||''}));}
    catch(error){if($('form-error'))$('form-error').textContent=error.message;toast(error.message,true);return false;}
  }
  const settings=()=>tableViews.current();
  function filtersActive(){return $('search').value.trim()||settings().filters.length;}
  function inMonth(r,month=settings().month){return month==='all'||(Array.isArray(r.ratMonths)?r.ratMonths.includes(month):(FLOW.definition(r).kind==='research'?Object.values(r.researchDates||{}).some(d=>d?.startsWith(month)):r.launchDate?.startsWith(month))||r.period===month);}
  function scoped(config){return records.filter(r=>inMonth(r,config.month)).filter(r=>config.scope==='all'||config.scope==='rd'&&([0,1,2,3,10,11,12,13].includes(r.stage))||config.scope==='mine'&&mine(r)||config.scope==='attention'&&attention(r)||config.scope==='done'&&isDone(r));}
  function filtered(){
    const q=$('search').value.trim().toLowerCase(),config=settings(),context=fieldAdapter.context();
    const base=scoped(config).filter(r=>!q||(r.title+' '+r.version+' '+r.issues?.join(' ')+' '+(ACTORS.find(a=>a.id===r.pm)?.name||r.pm||'')+' '+r.owner).toLowerCase().includes(q));
    return viewModel.sort(viewModel.filter(base,config.filters,fieldAdapter.fields,context),config.sorts,fieldAdapter.fields,context);
  }
  function clearFilters(){ $('search').value='';searchOpened.clear();tableViews.change({filters:[]}); }
  function stateLabel(r) { if(r.workflow||r.stage>=12)return FLOW.label(r.stage);return isDone(r)?'上线确认完成':([4,5,6].includes(r.stage)?FLOW.label(r.stage):r.sourceStatus||STATES[r.stage].label)+(r.gate.rejection?' · '+(r.stage===2?'未准入':'未准出'):''); }
  function badge(r) { return '<span class="status-chip tone-'+STATES[r.stage].tone+(!isDone(r)&&r.gate.rejection?' state-blocked':'')+'">'+stateLabel(r)+'</span>'; }
  function pendingNames(r) { return r.stage===2?[!r.gate.rd?'研发负责人':'',!r.gate.qa?'质量负责人':''].filter(Boolean).join('、'):'质量负责人'; }
  function moduleChips(r) {
    return '<div class="module-chips" title="'+esc(r.leadModule?'牵头：'+r.leadModule+'；参与：'+r.modules.join('、'):'参与：'+r.modules.join('、')+'；牵头待明确')+'">'+r.modules.map(m=>'<span class="module-chip '+(m===r.leadModule?'lead-module':'')+'">'+esc(m)+'</span>').join('')+'</div>';
  }
  function cell(r,col) {
    const pm=ACTORS.find(a=>a.id===r.pm);
    if(col.id==='title') return '<div class="fe-title"><span class="fe-id">'+esc(r.code||'')+'</span><button class="fe-link" data-action="open" data-id="'+r.id+'" title="'+esc(r.title)+'">'+esc(r.title)+'</button>'+(r.kind&&r.kind!=='fe'?'<span class="identity-note">归属待核对</span>':'')+'<button type="button" class="status-trigger mobile-flow-trigger" data-action="row-state" data-id="'+esc(r.id)+'">'+esc(stateLabel(r))+'</button></div>';
    if(col.id==='package')return r.version?'<button type="button" class="package-link" data-action="open-package" data-version="'+esc(r.version)+'" title="'+esc(r.version)+'">'+esc(r.version)+'</button>':'<span class="muted">未关联包</span>';
    if(col.id==='topic') return r.topic?'<span class="topic-dot"></span>'+esc(r.topic):'<span class="muted">—</span>';
    if(col.id==='priority') return '<span class="priority-tag '+(r.priority==='T0'?'priority-high':'')+'">'+esc(r.priority||'—')+'</span>';
    if(col.id==='owner') return '<span class="person-name" title="'+esc(r.owner||'未填写')+'">'+esc(r.owner||'—')+'</span>';
    if(col.id==='module') return moduleChips(r);
    if(col.id==='pm') return '<span class="pm">'+(pm?esc(pm.name):esc(r.pm||'—'))+'</span>';
    if(col.id==='status') return '<button class="status-trigger" data-action="row-state" data-id="'+r.id+'" title="查看状态或处理门禁" aria-label="'+esc(r.title)+' 当前状态：'+stateLabel(r)+'，查看或处理">'+badge(r)+'</button>'+(!FLOW.active(records,r.id)&&!isDone(r)&&r.gate.pending&&!r.gate.rejection?'<span class="gate-wait" title="等待'+esc(pendingNames(r))+'确认" aria-label="等待'+esc(pendingNames(r))+'确认"></span>':'');
    if(col.period){const period=schedule(r).find(p=>p.id===col.period);return period?periodMarkup(r,period):'<span class="muted">不适用</span>';}
    return '<button class="row-more" data-action="open" data-id="'+r.id+'" aria-label="查看 '+esc(r.id)+' 详情">'+icon('right')+'</button>';
  }
  function groupTree(list){return viewModel.group(list,settings().groups,fieldAdapter.fields,fieldAdapter.context());}
  function orderedRecords(){const list=filtered();if(!settings().groups.length)return list;const walk=nodes=>nodes.flatMap(n=>n.children.length?walk(n.children):n.records);return walk(groupTree(list));}
  const groupClosed=id=>settings().closed.includes(id)&&!searchOpened.has(id);
  function groupTone(node){
    if(node.field==='package')return 'nested';
    if(['packageStage','status'].includes(node.field)){
      const stage=node.field==='status'?Number(node.key):Number(/^stage-(\d+)$/.exec(node.key)?.[1]??-1);
      return ({0:'slate',1:'blue',2:'indigo',3:'violet',4:'cyan',5:'teal',6:'amber',7:'green',8:'green'})[stage]||'slate';
    }
    const text=node.field+':'+node.key;let hash=0;for(const c of text)hash=(hash*31+c.codePointAt(0))>>>0;
    return ['blue','indigo','violet','cyan','teal','amber'][hash%6];
  }
  function feRow(r,columns){
    let left=0;const periods=schedule(r),firstSchedule=periods[0]?.id==='demand'?1:0,currentIndex=periods.findIndex(p=>p.state==='current'||p.state==='completed'),mobileIndex=Math.max(firstSchedule,currentIndex<0?periods.findIndex(p=>p.state==='future'):currentIndex);
    return '<tr data-fe="'+esc(r.id)+'" class="'+(isDone(r)||r.stage===9?'done ':'')+(selected===r.id?'selected':'')+'">'+columns.map(c=>{
      const offset=left;if(c.base)left+=c.width;const p=periods.find(p=>p.id===c.period);
      return '<td data-column="'+c.id+'" '+(p?'data-period="'+p.id+'" data-mobile-label="'+p.name+'" ':'')+'class="cell-'+c.id+(c.base?' fixed-base':'')+(p?' period-cell period-'+p.state+([periods[mobileIndex]?.id,periods[mobileIndex+1]?.id].includes(p.id)?' mobile-period':'')+(p.overdue?' period-overdue':'')+(stageCell(r,p).today?' period-today':''):'')+'"'+(c.base?' style="--stick-left:'+offset+'px"':'')+'>'+cell(r,c)+'</td>';
    }).join('')+'</tr>';
  }
  function groupedRows(list,columns){
    if(!settings().groups.length)return list.map(r=>feRow(r,columns)).join('');
    function walk(nodes,depth=0){return nodes.map(node=>{
      const open=!groupClosed(node.id),field=fieldAdapter.fields.find(f=>f.id===node.field);
      const counts=node.total&&node.total!==node.records.length?node.records.length+' / '+node.total+' 项':node.records.length+' 项';
      const packageCount=node.field==='packageStage'?new Set(node.records.map(r=>r.version).filter(Boolean)).size:0;
      const count=(packageCount?packageCount+' 包 · ':'')+counts;
      let html='<tr class="fe-group-row '+(depth?'fe-group-package':'')+'" data-group-field="'+node.field+'" data-group-tone="'+groupTone(node)+'"><th colspan="'+columns.length+'"><div class="fe-group-label" style="--group-depth:'+depth+'"><button type="button" class="fe-group-toggle" data-action="view-toggle-group" data-group-id="'+esc(node.id)+'" aria-expanded="'+open+'"><span class="group-toggle-mark" aria-hidden="true">'+(open?'−':'+')+'</span><span class="fe-group-field">'+esc(field.label)+'</span><strong>'+esc(node.label)+'</strong><span class="fe-group-count">'+esc(count)+'</span></button>'+(node.field==='package'&&node.key?'<button type="button" class="text-button" data-action="open-package" data-version="'+esc(node.key)+'">查看包</button>':'')+'</div></th></tr>';
      if(open)html+=node.children.length?walk(node.children,depth+1):node.records.map(r=>feRow(r,columns)).join('');return html;
    }).join('');}
    return walk(groupTree(list));
  }
  function render() {
    const config=settings();view=config.scope;
    const base=records.filter(r=>inMonth(r)),list=filtered(),columns=config.columns.map(id=>COLUMNS.find(c=>c.id===id)).filter(Boolean).map(c=>({...c,base:c.id==='title'}));
    tableViews.paint();
    $('total-label').textContent=base.length+' 条记录'; $('nav-count').textContent=records.length;
    let left=0;
    const attrs=c=>{const offset=left;if(c.base)left+=c.width;return ' data-column="'+c.id+'" class="cell-'+c.id+(c.base?' fixed-base':'')+'"'+(c.base?' style="--stick-left:'+offset+'px"':'');};
    $('fe-table').style.width=columns.reduce((n,c)=>n+c.width,0)+'px';
    $('cols').innerHTML=columns.map(c=>'<col class="col-'+c.id+'" style="width:'+c.width+'px">').join('');
    $('table-head').innerHTML='<tr>'+columns.map(c=>'<th scope="col"'+attrs(c)+'>'+c.name+'</th>').join('')+'</tr>';
    $('rows').innerHTML=groupedRows(list,columns);
    $('empty').hidden=list.length>0; $('fe-table').hidden=list.length===0;
    $('result-count').textContent='显示 '+list.length+' / '+base.length+' 项'+(view==='all'&&!filtersActive()?'  ·  '+base.filter(r=>!isDone(r)&&r.stage!==9).length+' 项进行中':'');
    $('clear-filters').hidden=!filtersActive();
    const meta=$('detail').querySelector('.detail-meta'), current=getRecord();
    if(meta&&current)meta.innerHTML=detailMetaMarkup(current);
    flowUI?.tasks();$('actor-avatar').textContent=actor.name[0]; if(bookUI)bookUI.refresh();
  }
  function selectOptions(values, current, emptyLabel = '') {
    return (emptyLabel ? '<option value="">' + esc(emptyLabel) + '</option>' : '') + values.map(v => '<option value="' + esc(v) + '" ' + (current === v ? 'selected' : '') + '>' + esc(v) + '</option>').join('');
  }
  function defaultPM() { return actor.kind === 'pm' ? actor.id : ''; }
  function emptyRecord() {
    return normalizeRecord({ title: '', topic: '', modules: [actor.module || MODULES[0] || ''], pm: defaultPM(), stage:newWorkflowKind==='research'?12:0,...(newWorkflowKind==='research'?{workflow:{kind:'research',path:[12,13,14]},researchDates:{}}:{}), plans: [], launchDate: '', description: '', history: [], gate: { pending: false, rd: false, qa: false, round: 1, rejection: '' } });
  }
  function basicFields(r, fresh = false) {
    const input=(name,label,value,type='text')=>'<label class="form-field">'+label+'<input type="'+type+'" name="'+name+'" value="'+esc(value||'')+'"></label>';
    const text=(name,label,value)=>'<label class="form-field">'+label+'<textarea name="'+name+'" maxlength="20000">'+esc(value||'')+'</textarea></label>';
    const choices=(name,label,value,values)=>'<label class="form-field">'+label+'<select name="'+name+'">'+selectOptions([...new Set([...values,...records.map(x=>x[name]),value].filter(Boolean))],value,'未设置')+'</select></label>';
    return '<label class="form-field">FE／内容名称 <span class="required">必填</span><input name="title" required maxlength="10000" value="'+esc(r.title)+'"></label>'+
      '<div class="form-grid"><label class="form-field">所属模块（牵头）<select name="module" id="form-module" '+(fresh?'required':'')+'>'+selectOptions(MODULES,r.leadModule||'','未明确牵头模块')+'</select></label>'+(FLOW.definition(r).kind==='research'?'<span class="form-tip">研究任务无发布上线阶段</span>':input('launchDate','上线日期',r.launchDate,'date'))+'</div>'+
      '<fieldset class="collaborators"><legend>协作模块 <span>可多选</span></legend><div id="partner-options">'+partnerOptions(r.leadModule||'',r.modules.filter(m=>m!==r.leadModule))+'</div></fieldset>'+
      '<div class="form-grid">'+input('pm','所属 PM',ACTORS.find(a=>a.id===r.pm)?.name||r.pm)+input('owner','负责人（研发）',r.owner)+'</div>'+
      '<div class="form-grid"><label class="form-field">所属专项<select name="topic">'+selectOptions(TOPICS,r.topic,'待补充')+'</select></label>'+(FLOW.definition(r).kind==='research'?'':input('version','包名（版本标识）',r.version))+'</div>'+
      '<div class="form-grid">'+input('testOwner','测试责任人',r.testOwner)+input('priority','优先级',r.priority)+'</div>'+
      '<div class="form-grid">'+choices('risk','风险标记',r.risk,['无','有'])+choices('expectation','周计划预期',r.expectation,['方案','开发','自测','实验室','完成测试','单车','编组','灰度','全车'])+'</div>'+
      text('issues','关联问题',(r.issues||[]).join('\n'))+
      text('notes','跟进备注',(r.notes||[]).join('\n\n'))+text('description','补充说明',r.description);
  }
  function okrFields(r) {
    return '<p class="section-description">分别填写目标、关键结果与衡量指标。</p>'+[['okrO','目标（O）',r.okrO],['okrKR','关键结果（KR）',r.okrKR],['metric','衡量指标',r.metric]].map(([name,label,value])=>'<label class="form-field">'+label+'<textarea name="'+name+'" maxlength="20000">'+esc(value||'')+'</textarea></label>').join('');
  }
  function changeFields(r) {
    return '<p class="section-description">保存修改后可回查前后内容、记录人和时间。本次原因随这次修改一起保存。</p><label class="form-field">本次变更原因 <span class="muted">选填</span><textarea name="changeReason" maxlength="2000" placeholder="如：补充验证、资源调整、排期确认"></textarea></label><label class="form-field">变更说明<textarea name="changes" maxlength="20000">'+esc((r.changes||[]).join('\n\n'))+'</textarea></label>'+historyMarkup(r,true);
  }
  function partnerOptions(lead, partners = []) {
    return MODULES.filter(m => m !== lead).map(m => '<label class="check-chip"><input type="checkbox" name="partner" value="' + esc(m) + '" ' + (partners.includes(m) ? 'checked' : '') + '><span>' + esc(m) + '</span></label>').join('');
  }
  function phaseFields(r) {
    if(FLOW.definition(r).kind==='research')return '<p class="section-description">研究任务只记录自身的开始和结束日期。</p><div class="form-grid">'+[['plannedStart','计划开始'],['plannedEnd','计划结束'],['actualStart','实际开始'],['actualEnd','实际结束']].map(([key,name])=>'<label class="form-field">'+name+'<input type="date" name="research.'+key+'" value="'+esc(r.researchDates?.[key]||'')+'"></label>').join('')+'</div>';
    return '<div class="planning-shortcut-line"><p class="section-description">已到达阶段保留发生日期，未到达阶段保留当前排期；测试栏沿用表中提测日期，不代表提测会通过。单车、编组、灰度及研发上线确认的实际日期按本包同步；研发与测试日期各自记录，车辆升级由交付记录。</p><button type="button" class="btn" data-action="planning-open">排期规则</button></div><p class="planning-date-feedback" id="planning-date-feedback" role="status" hidden></p><div class="phase-table-wrap"><table id="phase-dates" class="entry-dates"><thead><tr><th>阶段</th><th>立项预期</th><th>当前排期</th><th>实际进入／完成</th></tr></thead><tbody>'+ENTRY_PERIODS.filter(p=>!r.workflow?.path||(p.id==='development'?r.workflow.path.some(s=>s===1||s===2):r.workflow.path.includes(({testing:3,single:4,group:5,gray:6,launch:8})[p.id]))).map(p=>'<tr><th scope="row">'+p.name+'</th><td class="baseline-date">'+esc(r.baselinePlans?.[p.id==='testing'?'测试':p.name]||'—')+'</td><td>'+dateInput(r,entryPath(p),p.name+' 计划进入')+'</td><td>'+dateInput(r,entryPath(p,true),p.id==='launch'?'研发上线确认完成日期':p.name+' 实际进入')+'</td></tr>').join('')+'</tbody></table></div>'+sourceDateNotes(r);
  }
  function sourceDateNotes(r){
    const notes=[...(r.sourceDateNotes||[]).map(n=>n.phase+' '+n.date+'：'+n.text),...(r.sourceDateConflicts||[]).map(n=>dateLinks.label(n.path)+'：保留手填 '+(n.local||'空白')+'；资料记录 '+n.source)];
    return notes.length?'<details class="source-date-notes"><summary>日期说明 · '+notes.length+' 项</summary>'+notes.map(n=>'<p>'+esc(n)+'</p>').join('')+'</details>':'';
  }
  function dateInput(r,path,label){
    return '<div class="date-input-wrap"><input type="date" name="'+path+'" aria-label="'+esc(label)+'" value="'+esc(dateLinks.get(r,path))+'"></div>';
  }
  function syncDateInputs(){
    if(!dateDraft||!$('fe-form'))return;
    [...dateLinks.paths,'launchDate','releaseConfirmedDate'].forEach(path=>{const input=$('fe-form').elements.namedItem(path);if(input&&input.value!==dateLinks.get(dateDraft,path))input.value=dateLinks.get(dateDraft,path);});
  }
  function applyPlanning(record,anchor){
    const updates=planning.planUpdates(record,planningRules,anchor);
    updates.forEach(u=>{dateLinks.edit(record,u.path,u.value);record.dateLinks[u.path]={mode:'calculated',anchor};});
    return updates.length;
  }
  function fillDateDraft(){
    if(!dateDraft||!$('detail').open||!(drawerMode==='full-new'||canEdit(getRecord()||{})))return;
    const anchor=lastPlanAnchor||planning.nodes.find(n=>dateLinks.get(dateDraft,n.path))?.path;
    if(anchor){const count=applyPlanning(dateDraft,anchor);showDateFeedback(count);if(count){syncDateInputs();markDirty();}}
  }
  function showDateFeedback(count){
    const el=$('planning-date-feedback');if(!el)return;
    el.hidden=false;el.textContent=count?'已补齐 '+count+' 个计划日期，保存后生效。':planningRules.gaps.every(x=>x===null)?'尚未设置排期间隔。':planning.nodes.every(n=>dateLinks.get(dateDraft,n.path))?'其余计划日期已有值，已保留。':'空白阶段的间隔尚未连通，已有计划保留。';
  }
  function handleDateEdit(input){
    if(!dateDraft||!input.closest('#fe-form')||!(dateLinks.paths.includes(input.name)||input.name==='launchDate'||input.name==='releaseConfirmedDate'))return;
    if(dateLinks.get(dateDraft,input.name)===input.value)return;
    dateLinks.edit(dateDraft,input.name,input.value);
    const anchor=input.name==='launchDate'?'plan.上线':input.name;
    if(planning.nodes.some(n=>n.path===anchor)&&input.value){lastPlanAnchor=anchor;showDateFeedback(applyPlanning(dateDraft,anchor));}
    else if((input.name.includes('actual')||input.name==='releaseConfirmedDate')&&$('planning-date-feedback')){const stage=Object.entries(window.LubanPackageDates.paths).find(([,path])=>path===input.name)?.[0],count=stage&&dateDraft.id?window.LubanPackageDates.members(records,dateDraft,Number(stage)).length:1;$('planning-date-feedback').hidden=false;$('planning-date-feedback').textContent=stage&&count>1?dateLinks.label(input.name)+'将同步本包 '+count+' 项，保存后生效；计划日期不变。':'实际日期不参与计划排期计算。';}
    syncDateInputs();
  }
  function suggestFormPM(){
    const form=$('fe-form'),input=form?.elements.namedItem('pm');if(!input||pmEdited||input.value.trim())return;
    const lead=form.elements.namedItem('module')?.value||'',partners=[...form.querySelectorAll('[name="partner"]:checked')].map(el=>el.value);
    const name=pmDirectory.recommend({leadModule:lead,modules:[lead,...partners].filter(Boolean)});
    if(name){input.value=name;if(dateDraft)dateDraft.pmSource='module';}
  }
  function rollbackRow(record = {}, index = 0) {
    if(Number.isInteger(record.from)&&Number.isInteger(record.to))return '<article class="flow-generated-rollback"><strong>'+esc(FLOW.label(record.from))+' → '+esc(FLOW.label(record.to))+'</strong><p>'+esc(record.reason||'')+'</p><small>实际回退：'+esc(record.date||localDate(record.at))+' · '+esc(record.actor||'')+' · '+esc(record.version||'未关联包')+'</small></article>';

    return '<div class="rollback-row" data-key="' + esc(record.id || '') + '"><div class="entry-row-title"><span>第 ' + (index + 1) + ' 次回退</span>' + (!record.id ? '<button class="text-button" type="button" data-action="remove-rollback">移除</button>' : '') + '</div>' +
      '<label class="form-field">回退时间<input name="rollbackAt" type="datetime-local" value="' + esc(record.at || '') + '"></label>' +
      '<div class="form-grid"><label class="form-field">涉及阶段<input name="rollbackStage" value="'+esc(record.stage||'')+'" placeholder="选填"></label><label class="form-field">相关版本<input name="rollbackVersion" value="'+esc(record.version||'')+'" placeholder="选填"></label></div>'+
      '<label class="form-field">回退原因<textarea name="rollbackReason" maxlength="1000" placeholder="说明这次回退的原因">' + esc(record.reason || '') + '</textarea></label></div>';
  }
  function safeURL(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  }
  function documentRow(record = {}, index = 0) {
    const href = safeURL(record.url);
    return '<div class="document-row" data-key="' + esc(record.id || '') + '"><div class="entry-row-title"><span>文档 ' + (index + 1) + '</span><button class="text-button" type="button" data-action="remove-document">移除</button></div>' +
      '<label class="form-field">文档名称<input name="docName" maxlength="120" placeholder="如：提测报告、问题单回复" value="' + esc(record.name || '') + '"></label>' +
      '<label class="form-field">文档链接<input name="docUrl" type="url" maxlength="2000" placeholder="https://…" value="' + esc(record.url || '') + '"></label>' +
      (href ? '<a class="document-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" aria-label="打开 ' + esc(record.name || '文档') + '">' + icon('link') + '打开文档 ↗</a>' : '') + '</div>';
  }
  function historyMarkup(r,changesOnly=false) {
    const entries=r.history.filter(h=>!changesOnly||h.kind==='change'||h.text?.includes(' → '));
    return '<details class="history" open><summary>'+(changesOnly?'变更记录':'流转与操作记录')+' · '+entries.length+' 条</summary>'+(entries.length?'<ol>'+entries.slice().reverse().map(h=>'<li><strong>'+esc(h.text)+'</strong>'+(h.reason?'<p class="change-reason">原因：'+esc(h.reason)+'</p>':h.kind==='change'?'<span class="muted">原因未填写</span>':'')+(h.items?.length?'<dl class="change-items">'+h.items.map(x=>'<div><dt>'+esc(x.label)+'</dt><dd><span>'+esc(x.before||'空')+'</span><span> → </span><span>'+esc(x.after||'空')+'</span></dd></div>').join('')+'</dl>':'')+'<time>'+time(h.at)+'</time>'+esc(h.actor)+'</li>').join('')+'</ol>':'<p class="form-tip">暂无记录，保存修改或完成流转后在此查看。</p>')+'</details>';
  }
  function detailMetaMarkup(r) {
    return badge(r)+'<span>PM '+esc(ACTORS.find(a=>a.id===r.pm)?.name||r.pm||'待指定')+'</span><span>研发 '+esc(r.owner||'待指定')+'</span>'+(r.version?'<span class="copy-code">'+esc(r.version)+'</span>':'');
  }
  function intakeOriginMarkup(r){
    const refs=(r.intakeRefs||[]).map(ref=>({d:intakeData.demands.find(d=>d.id===ref.demandId),t:intakeData.tasks.find(t=>t.id===ref.taskId)})).filter(x=>x.d&&x.t);
    return refs.length?'<div class="intake-fe-origins"><h3>需求与月度计划</h3>'+refs.map(({d,t})=>'<p><button type="button" class="text-button intake-origin-link" data-action="intake-origin" data-demand-id="'+esc(d.id)+'">'+esc(window.LubanIntake.title(d))+'</button> · '+esc(t.month+' '+t.module)+' · '+esc(t.title)+'</p>').join('')+'</div>':'';
  }
  function overviewMarkup(r){
    const periods=schedule(r),p=periods.find(p=>p.state==='current'),terminal=FLOW.terminal(r);
    const research=FLOW.definition(r).kind==='research',deadline=research?(r.stage===12?r.researchDates?.plannedStart:r.researchDates?.plannedEnd)||'':p?.nextEntry||'',remaining=deadline?Math.round((Date.parse(deadline)-Date.parse(TODAY))/86400000):null;
    const deadlineText=terminal?'已结束':deadline?date(deadline):'日期待补';
    const nextText=terminal?'无后续阶段':research?FLOW.label(FLOW.next(r)):p?.next?.name||'阶段待明确';
    return '<section class="execution-overview"><div class="execution-strip"><div><span>当前阶段</span><strong>'+esc(stateLabel(r))+'</strong></div><div><span>本阶段截止</span><strong class="'+(remaining!==null&&remaining<0?'text-danger':'')+'">'+esc(deadlineText)+'</strong><small>'+(remaining===null?'':remaining<0?'排期已超期 '+(-remaining)+' 天':remaining===0?'今天到期':'距截止 '+remaining+' 天')+'</small></div><div><span>下一阶段</span><strong>'+esc(nextText)+'</strong></div></div>'+
      (r.stage>=4&&r.stage<=8&&r.version?'<div class="execution-context">生产阶段按整包推进 <button type="button" class="text-button" data-action="open-package" data-version="'+esc(r.version)+'">查看版本核对</button></div>':'')+
      intakeOriginMarkup(r)+(bookUI?.recordProgressMarkup(r)||'')+
      (progressEditing?'<div class="execution-quick-editor">'+(bookUI?.recordQuickProgressMarkup(r)||'')+'</div>':'')+
      '<div class="execution-actions"><button type="button" class="btn '+(progressEditing?'':'primary')+'" data-action="quick-progress" aria-expanded="'+progressEditing+'">'+(progressEditing?'收起填写':'填写今日进展')+'</button><button type="button" class="btn" data-action="row-state" data-id="'+esc(r.id)+'">状态与流转</button>'+'</div>'+
      '<div class="section-title-line"><h3>当前与未来排期</h3><button type="button" class="text-button" data-action="detail-tab" data-target-tab="dates">编辑阶段日期</button></div><div class="execution-schedule">'+periods.filter(p=>p.id!=='demand'&&p.state!=='past').map(p=>'<div><strong>'+p.name+'</strong><span>计划 '+esc(p.start?date(p.start):'未填')+'</span><span class="muted">实际 '+esc(p.actualStart?date(p.actualStart):'未记录')+'</span></div>').join('')+'</div></section>';
  }
  function drawDetail() {
    const saved = getRecord(), fresh = drawerMode === 'full-new';
    if (!saved && !fresh) return;
    const r = saved || emptyRecord(), editable = fresh || canEdit(r);
    progressEditing=false;
    dateDraft=structuredClone(r);lastPlanAnchor='';pmEdited=false;
    const list = orderedRecords(), index = list.findIndex(x => x.id === r.id);
    dirty = false;
    $('detail').innerHTML = '<div class="drawer-top"><span>' + (fresh ? '完整新建 FE' : (r.kind==='content'?'发布内容详情':'FE 详情')) + '</span><div class="drawer-top-actions">' +
      (!fresh ? '<button class="btn icon-button" data-action="prev" aria-label="上一个 FE" ' + (index <= 0 ? 'disabled' : '') + '>' + icon('left') + '</button><button class="btn icon-button" data-action="next" aria-label="下一个 FE" ' + (index < 0 || index >= list.length - 1 ? 'disabled' : '') + '>' + icon('right') + '</button>' : '') +
      '<button class="btn icon-button" data-action="close-detail" aria-label="关闭详情">' + icon('close') + '</button></div></div>' +
      '<div class="detail-heading"><h2 id="detail-title">' + (fresh ? '完整新建 FE' : esc(r.title)) + '</h2>' + (!fresh ? '<div class="detail-meta">' + detailMetaMarkup(r) + '</div>' : '<p class="section-description">先填基本信息，其余内容可以以后补齐。</p>') + '</div>' +
      '<nav class="detail-tabs" role="tablist" aria-label="FE 详情分区">' + [['overview','执行概览'], ['daily','每日进展'], ['dates', '阶段日期'], ['basic', '基本信息'], ['okr','OKR'], ['documents', '相关文档'], ['changes','变更管理'], ['rollbacks', '回退记录'], ['activity','流转记录'], ['source', '数据记录']].map(([id, name],i) => '<button type="button" role="tab" class="'+(i>=3?'detail-tab-secondary':'')+'" id="tab-' + id + '" aria-controls="panel-' + id + '" aria-selected="' + (detailTab === id) + '" tabindex="'+(detailTab===id?'0':'-1')+'" data-action="detail-tab" data-tab="' + id + '">' + name + '</button>').join('') + '</nav>' +
      '<form id="fe-form" class="drawer-scroll" novalidate><section id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" '+(detailTab!=='overview'?'hidden':'')+'>'+(fresh?'<p class="form-tip">创建后查看执行情况。</p>':overviewMarkup(r))+'</section><fieldset class="details-fields" ' + (!editable ? 'disabled' : '') + '>' +
      '<section id="panel-basic" role="tabpanel" aria-labelledby="tab-basic" ' + (detailTab !== 'basic' ? 'hidden' : '') + '>' + basicFields(r, fresh) + '</section>' +
      '<section id="panel-okr" role="tabpanel" aria-labelledby="tab-okr" '+(detailTab!=='okr'?'hidden':'')+'>'+okrFields(r)+'</section>'+
      '<section id="panel-changes" role="tabpanel" aria-labelledby="tab-changes" '+(detailTab!=='changes'?'hidden':'')+'>'+changeFields(r)+'</section>'+
      '<section id="panel-activity" role="tabpanel" aria-labelledby="tab-activity" '+(detailTab!=='activity'?'hidden':'')+'>'+historyMarkup(r)+'</section>'+
      '<section id="panel-dates" role="tabpanel" aria-labelledby="tab-dates" ' + (detailTab !== 'dates' ? 'hidden' : '') + '>' + phaseFields(r) + '</section>' +
      '<section id="panel-daily" role="tabpanel" aria-labelledby="tab-daily" '+(detailTab!=='daily'?'hidden':'')+'>'+(fresh?'<p class="form-tip">创建后可填写每日进展。</p>':bookUI?.recordDailyMarkup(r)||'')+'</section>'+
      '<section id="panel-rollbacks" role="tabpanel" aria-labelledby="tab-rollbacks" ' + (detailTab !== 'rollbacks' ? 'hidden' : '') + '><p class="section-description">状态回退记录自动保留；补录历史记录不会改变当前状态。</p><div id="rollback-entries">' + r.rollbacks.map(rollbackRow).join('') + '</div><p class="inline-empty" id="rollback-empty" ' + (r.rollbacks.length ? 'hidden' : '') + '>暂无回退记录</p><button class="btn" type="button" data-action="add-rollback">' + icon('plus') + '补录历史回退记录</button></section>' +
      '<section id="panel-documents" role="tabpanel" aria-labelledby="tab-documents" ' + (detailTab !== 'documents' ? 'hidden' : '') + '><p class="section-description">关联已有报告、问题单和其他资料的链接。</p><div id="document-entries">' + r.documents.map(documentRow).join('') + '</div><p class="inline-empty" id="document-empty" ' + (r.documents.length ? 'hidden' : '') + '>暂无文档链接</p><button class="btn" type="button" data-action="add-document">' + icon('plus') + '添加文档链接</button></section><section id="panel-source" role="tabpanel" '+(detailTab!=='source'?'hidden':'')+'>'+ (bookUI?bookUI.recordSourceMarkup(r):'')+'</section></fieldset>' +
      '<p id="form-error" class="field-error" role="alert"></p></form>' +
      '<div class="detail-footer"><span class="footer-note" id="draft-label">' + (editable ? '信息可逐步补齐 · 修改后请保存' : '由 ' + esc(ACTORS.find(a => a.id === r.pm)?.name || '所属 PM') + ' 维护') + '</span><div class="detail-footer-actions"><button class="btn" data-action="close-detail">关闭</button>' + (editable ? '<button type="button" class="btn primary" data-action="daily-save" '+(detailTab!=='daily'||fresh?'hidden':'')+'>保存今日进展</button><button id="save-fe" class="btn primary" type="submit" form="fe-form" ' + (['overview','daily'].includes(detailTab)&&!fresh?'hidden':'') + '>' + (fresh ? '创建 FE' : '保存修改') + '</button>' : '') + '</div></div>';
    syncDateInputs();
    if(detailTab==='daily'&&!fresh)$('draft-label').textContent='保存本 FE 的今日进展';
    if(detailTab==='overview'&&!fresh)$('draft-label').textContent='进展与风险由 PM 更新，日期和状态可分别跟进';
  }
  function switchDetailTab(tab) {
    if(progressEditing){progressEditing=false;$('panel-overview').innerHTML=overviewMarkup(getRecord());}
    if(tab==='daily'&&getRecord())$('panel-daily').innerHTML=bookUI.recordDailyMarkup(getRecord());
    detailTab = tab;
    document.querySelectorAll('.detail-tabs [role="tab"]').forEach(el => {el.setAttribute('aria-selected', String(el.dataset.tab === tab));el.tabIndex=el.dataset.tab===tab?0:-1;});
    ['overview','basic', 'okr', 'dates', 'daily', 'changes', 'rollbacks', 'documents', 'source', 'activity'].forEach(id => $('panel-' + id).hidden = id !== tab);
    if($('save-fe'))$('save-fe').hidden=['daily','overview'].includes(tab)&&drawerMode!=='full-new';
    $('detail').querySelector('.detail-footer [data-action="daily-save"]')?.toggleAttribute('hidden',tab!=='daily'||drawerMode==='full-new');
    if($('draft-label')&&!dirty)$('draft-label').textContent=tab==='overview'?'进展与风险由 PM 更新，日期和状态可分别跟进':tab==='daily'?'保存本 FE 的今日进展':canEdit(getRecord()||{})?'信息可逐步补齐 · 修改后请保存':'由所属 PM 维护';
    $('tab-'+tab)?.scrollIntoView({block:'nearest',inline:'nearest'});
    $('detail').querySelector('.drawer-scroll').scrollTop = 0;
  }
  function markDirty() {
    dirty = true;
    if ($('draft-label')) $('draft-label').textContent = '有未保存的修改';
  }
  let pendingLeave = null;
  function requestLeave(action) {
    if(intakeUI?.hasDrafts())return intakeUI.guard(()=>requestLeave(action));
    if(reportingUI?.hasDrafts())return reportingUI.guard(()=>requestLeave(action));
    if (dirty && $('detail').open) { pendingLeave = action; $('discard-dialog').showModal(); }
    else action();
  }
  function openDetail(id,tab='overview') {
    requestLeave(() => { selected = id; drawerMode = 'view'; detailTab = tab; drawDetail(); if (!$('detail').open) $('detail').showModal(); render(); });
  }
  function quickDateField(kind){return kind==='research'?'<label class="form-field">计划结束日期（选填）<input type="date" name="researchEnd"></label>':'<label class="form-field"><span class="field-heading">上线日期 <span class="required">必填</span></span><input type="date" name="launchDate" required></label>';}
  function showNew() {
    newWorkflowKind='release';
    $('quick-dialog').innerHTML = '<div class="modal-heading"><h2 id="quick-title">快速新建 FE</h2><button class="btn icon-button" data-action="close-quick" aria-label="关闭快速新建">' + icon('close') + '</button></div>' +
      '<form id="quick-form"><div class="modal-body"><p class="section-description">选择适用流程，创建后继续补齐负责人、OKR 和日期。</p>' +
      '<label class="form-field"><span class="field-heading">FE 名称 <span class="required">必填</span></span><input name="title" required maxlength="120" placeholder="用一句话描述这项工作"></label><label class="form-field">适用流程<select name="flowKind"><option value="release">研发发布</option><option value="research">研究任务</option></select></label><div class="form-grid"><label class="form-field">所属模块<select name="module" required>' + selectOptions(MODULES, actor.module || MODULES[0] || '') + '</select></label><div id="quick-schedule-field">'+quickDateField('release')+'</div></div><p id="quick-error" class="field-error" role="alert"></p></div>' +
      '<div class="modal-footer"><button type="button" class="text-button full-create" data-action="full-new">完整新建</button><button type="button" class="btn" data-action="close-quick">取消</button><button class="btn primary" type="submit">创建 FE</button></div></form>';
    $('quick-dialog').showModal(); $('quick-form').elements.title.focus();
  }
  function createRecord(values) {
    const used=[...records.map(r=>r.id),...archivedRecords.map(r=>r.id),...intakeData.tasks.map(t=>t.feId)];
    const id = 'FE-' + (Math.max(150, ...used.map(id=>/^FE-\d+$/.test(id)?Number(id.slice(3)):0)) + 1), at = now();
    const r = Object.assign(emptyRecord(), values, { id, createdBy: actor.id, entered: at, period: $('month').value==='all'&&(values.workflow?.kind||newWorkflowKind)==='research'?TODAY.slice(0,7):$('month').value, updated: at, history: [{ at, actor: actor.name, text: '创建 FE，待开发' }] });
    r.history[0].text='创建 FE，'+FLOW.label(r.stage);Object.assign(r,pmDirectory.fill(r));if(FLOW.definition(r).kind==='release'){dateLinks.edit(r,'plan.上线',r.launchDate||'');if(r.launchDate)applyPlanning(r,'plan.上线');}
    if (!save(records.concat([r]))) return false;
    tableViews.selectAll(); selected = id; drawerMode = 'view'; dirty = false; detailTab = 'basic'; drawDetail();
    if (!$('detail').open) $('detail').showModal(); render(); $('draft-label').textContent='已创建 '+id+' · 可以继续补齐信息'; toast('已创建 ' + id + '，可以继续补齐信息'); return true;
  }
  function submitQuick(e) {
    e.preventDefault();
    const form = e.target, data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) { $('quick-error').textContent = '请填写 FE 名称。'; form.elements.title.focus(); return; }
    if (!form.reportValidity()) return;
    newWorkflowKind=data.get('flowKind')==='research'?'research':'release';
    if (createRecord({ title, leadModule:String(data.get('module')), modules: [String(data.get('module'))], launchDate:newWorkflowKind==='research'?'':String(data.get('launchDate')||''), ...(newWorkflowKind==='research'?{workflow:{kind:'research',path:[12,13,14]},stage:12,researchDates:{plannedEnd:String(data.get('researchEnd')||'')}}:{}), pm: defaultPM() })) $('quick-dialog').close();
  }
  function collectValues(form) {
    const data = new FormData(form), module = String(data.get('module'));
    const values = { leadModule:module, title: String(data.get('title') || '').trim(), topic: String(data.get('topic') || ''), modules: [module, ...data.getAll('partner').filter(m => m !== module)].filter(Boolean), pm: String(data.get('pm') || ''), owner: String(data.get('owner') || '').trim(), okrO: String(data.get('okrO') || '').trim(), okrKR: String(data.get('okrKR') || '').trim(), launchDate: String(data.get('launchDate') || ''), description: String(data.get('description') || '').trim(), phaseDates: {}, productionPlans:{}, version:String(data.get('version')||'').trim(),testOwner:String(data.get('testOwner')||'').trim(),priority:String(data.get('priority')||'').trim(),risk:String(data.get('risk')||'').trim(),expectation:String(data.get('expectation')||'').trim(),metric:String(data.get('metric')||'').trim(),issues:String(data.get('issues')||'').split('\n').filter(Boolean),notes:String(data.get('notes')||'').split('\n\n').filter(Boolean),changes:String(data.get('changes')||'').split('\n\n').filter(Boolean),rollbacks: [], documents: [] };
    if(dateDraft.workflow)values.workflow=structuredClone(dateDraft.workflow);
    if(FLOW.definition(dateDraft).kind==='research'){values.researchDates=structuredClone(dateDraft.researchDates||{});for(const key of ['plannedStart','plannedEnd','actualStart','actualEnd'])values.researchDates[key]=String(data.get('research.'+key)||'');}
    values.pmSource=pmEdited?'manual':dateDraft.pmSource||'';
    values.productionPlans=structuredClone(dateDraft.productionPlans);
    values.dateLinks=structuredClone(dateDraft?.dateLinks||{});
    values.productionDates=structuredClone(dateDraft.productionDates);
    values.phaseDates=structuredClone(dateDraft.phaseDates);values.releaseConfirmedDate=dateDraft.releaseConfirmedDate||'';
    values.launchDate=dateDraft.launchDate||'';
    values.rollbacks=structuredClone((dateDraft.rollbacks||[]).filter(x=>Number.isInteger(x.from)&&Number.isInteger(x.to)));
    for (const row of form.querySelectorAll('.rollback-row')) {
      const at = row.querySelector('[name="rollbackAt"]').value, reason = row.querySelector('[name="rollbackReason"]').value.trim();
      if (!at && !reason && !row.dataset.key) continue;
      if (!at || !reason) { switchDetailTab('rollbacks'); throw new Error('请为这次回退填写时间和原因，或移除尚未填写的记录。'); }
      values.rollbacks.push({ ...(dateDraft.rollbacks||[]).find(x=>x.id===row.dataset.key),id: row.dataset.key || crypto.randomUUID(), at, reason, timezone: 'Asia/Shanghai',stage:row.querySelector('[name="rollbackStage"]').value.trim(),version:row.querySelector('[name="rollbackVersion"]').value.trim() });
    }
    values.rollbacks.sort((a,b)=>{const order=x=>{const i=(dateDraft.rollbacks||[]).findIndex(y=>y.id===x.id);return i<0?Number.MAX_SAFE_INTEGER:i;};return order(a)-order(b);});
    for (const row of form.querySelectorAll('.document-row')) {
      const name = row.querySelector('[name="docName"]').value.trim(), url = row.querySelector('[name="docUrl"]').value.trim();
      if (!name && !url) continue;
      if (!name || !safeURL(url)) { switchDetailTab('documents'); throw new Error('请填写文档名称和有效的 http 或 https 链接。'); }
      values.documents.push({ id: row.dataset.key || crypto.randomUUID(), name, url });
    }
    return dateLinks.resolve(values);
  }
  function submitForm(e,{closeAfterSave=true}={}) {
    e.preventDefault(); const form = e.target;
    const current = getRecord(), fresh = drawerMode === 'full-new';
    if (!fresh && (!current || !canEdit(current))) { toast('请由所属 PM 编辑。', true); return false; }
    if (!form.elements.title.value.trim()) { switchDetailTab('basic'); $('form-error').textContent = '请填写 FE 名称。'; form.elements.title.focus(); return false; }
    const invalid = Array.from(form.elements).find(el => el.willValidate && !el.validity.valid);
    if (invalid) { const panel = invalid.closest('[role="tabpanel"]'); if (panel) switchDetailTab(panel.id.replace('panel-', '')); invalid.reportValidity(); return false; }
    let values;
    try { values = collectValues(form); } catch (error) { $('form-error').textContent = error.message; return false; }
    if (fresh) return createRecord(values);
    const labels = { title: '名称', topic: '专项', modules: '参与模块',leadModule:'牵头模块', pm: '所属 PM', owner: '研发负责人', okrO: 'O', okrKR: 'KR', launchDate: '上线日期', description: '补充说明',version:'包名（版本标识）',testOwner:'测试责任人',priority:'优先级',risk:'风险',metric:'数字指标',issues:'关联问题',notes:'跟进备注',changes:'变更说明',expectation:'周计划预期' };
    const changes = [],items=[];
    const addChange=(label,before,after)=>{changes.push(label+'：'+(before||'空')+' → '+(after||'空'));items.push({label,before:before||'',after:after||''});};
    Object.keys(labels).forEach(key => {
      if (JSON.stringify(current[key]) !== JSON.stringify(values[key])) {
        const display = value => key === 'pm' ? ACTORS.find(a => a.id === value)?.name || value || '' : Array.isArray(value) ? value.join('、') : value || '';
        addChange(labels[key],display(current[key]),display(values[key]));
      }
    });
    if(values.researchDates)for(const key of ['plannedStart','plannedEnd','actualStart','actualEnd'])if(current.researchDates?.[key]!==values.researchDates[key])addChange('研究日期 '+key,current.researchDates?.[key]||'',values.researchDates[key]);
    ENTRY_PERIODS.forEach(p=>[false,true].forEach(actual=>{const path=entryPath(p,actual),before=dateLinks.get(current,path),after=dateLinks.get(values,path);if(before!==after)addChange(p.name+(actual?'实际进入':'计划进入'),before,after);}));
    if (JSON.stringify(current.rollbacks) !== JSON.stringify(values.rollbacks)) changes.push('回退记录已更新（' + values.rollbacks.length + ' 次）');
    if (JSON.stringify(current.documents) !== JSON.stringify(values.documents)) changes.push('相关文档已更新（' + values.documents.length + ' 个）');
    const reason=String(new FormData(form).get('changeReason')||'').trim();
    if (!update(current.id, r => { Object.assign(r, values); if (changes.length||reason) r.history.push({ at: now(), actor: actor.name,kind:'change',reason,items,text:changes.length?'修改 '+changes.map(c=>c.split('：')[0]).join('、'):'补充变更说明' }); })) return false;
    dirty = false;if(closeAfterSave)$('detail').close();else drawDetail();toast('修改已保存'); return true;
  }
  function openState(id) {
    requestLeave(()=>{selected=id;render();flowUI.open(id);});
  }
  function changeActor(id) {
    actor=ACTORS.find(a=>a.id===id)||ACTORS[0];$('actor').value=actor.id;
    render();if($('detail').open&&getRecord())drawDetail();
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-action]');if(!button)return;
    if(tableViews&&tableViews.handleClick(button))return;
    if(planningBatchUI&&planningBatchUI.handleClick(button))return;
    if(bookUI&&bookUI.handleClick(button))return;
    const action=button.dataset.action, r=getRecord();
    if(action==='stage-workflow'){openState(button.dataset.id);return;}
    if(action==='intake-origin'){requestLeave(()=>{dirty=false;$('detail').close();bookUI.showWorkspace('demand');intakeUI.openDemand(button.dataset.demandId);});return;}
    if(action==='outside')toast('该板块尚未启用。');
    if(action==='view-toggle-group'){
      const id=button.dataset.groupId,next=new Set(settings().closed),wasClosed=groupClosed(id);searchOpened.delete(id);if(wasClosed)next.delete(id);else next.add(id);tableViews.change({closed:[...next]});return;
    }
    if(action==='expand-fe-groups'){searchOpened.clear();tableViews.change({closed:[]});return;}
    if(action==='collapse-fe-groups'){const ids=[];const walk=nodes=>nodes.forEach(n=>{ids.push(n.id);walk(n.children);});walk(groupTree(filtered()));searchOpened.clear();tableViews.change({closed:ids});return;}
    if(action==='open')openDetail(button.dataset.id);
    if(action==='edit-dates')openDetail(button.dataset.id,'dates');
    if(action==='close-detail')requestLeave(()=>{dirty=false;$('detail').close();});
    if(action==='quick-progress'){
      progressEditing=!progressEditing;$('panel-overview').innerHTML=overviewMarkup(r);
      $('detail').querySelector('.detail-footer [data-action="daily-save"]')?.toggleAttribute('hidden',!progressEditing||!canEdit(r));
      if(!dirty)$('draft-label').textContent=progressEditing?'填写后保存今日进展':'进展与风险由 PM 更新，日期和状态可分别跟进';
      if(progressEditing)$('panel-overview').querySelector('[data-daily-text]').focus({preventScroll:true});
    }
    if(action==='clear')clearFilters();
    if(action==='detail-tab')switchDetailTab(button.dataset.tab||button.dataset.targetTab);
    if(action==='row-state')openState(button.dataset.id);
    if(action==='close-state')$('state-dialog').close();
    if(action==='close-quick')$('quick-dialog').close();
    if(action==='full-new'){
      const quick=new FormData($('quick-form'));newWorkflowKind=quick.get('flowKind')==='research'?'research':'release';
      $('quick-dialog').close();selected=null;drawerMode='full-new';detailTab='basic';drawDetail();
      ['title','module','launchDate'].forEach(name=>{const el=$('fe-form').elements.namedItem(name);if(el)el.value=quick.get(name)||'';});if(newWorkflowKind==='research'){dateDraft.researchDates||={};dateDraft.researchDates.plannedEnd=String(quick.get('researchEnd')||'');const el=$('fe-form').elements.namedItem('research.plannedEnd');if(el)el.value=dateDraft.researchDates.plannedEnd;}
      $('partner-options').innerHTML=partnerOptions(String(quick.get('module')||MODULES[0]||''));
      suggestFormPM();if(quick.get('title')||quick.get('launchDate'))markDirty();
      $('detail').showModal();
    }
    if(action==='add-rollback'){$('rollback-entries').insertAdjacentHTML('beforeend',rollbackRow({},$('rollback-entries').children.length));$('rollback-empty').hidden=true;markDirty();$('rollback-entries').lastElementChild.querySelector('input').focus();}
    if(action==='remove-rollback'){button.closest('.rollback-row').remove();$('rollback-empty').hidden=$('rollback-entries').children.length>0;markDirty();}
    if(action==='add-document'){$('document-entries').insertAdjacentHTML('beforeend',documentRow({},$('document-entries').children.length));$('document-empty').hidden=true;markDirty();$('document-entries').lastElementChild.querySelector('input').focus();}
    if(action==='remove-document'){button.closest('.document-row').remove();$('document-empty').hidden=$('document-entries').children.length>0;markDirty();}
    if(action==='keep-editing'){$('discard-dialog').close();pendingLeave=null;}
    if(action==='discard-changes'){const leave=pendingLeave;pendingLeave=null;dirty=false;$('discard-dialog').close();if(leave)leave();}
    if(action==='save-and-leave'){if(submitForm({preventDefault(){},target:$('fe-form')},{closeAfterSave:false})){const leave=pendingLeave;pendingLeave=null;$('discard-dialog').close();if(leave)leave();}}
    if(action==='prev'||action==='next'){const list=orderedRecords(),i=list.findIndex(x=>x.id===selected),next=list[i+(action==='prev'?-1:1)];if(next)openDetail(next.id);}
    if(action==='material')toast('请在相关文档中关联报告或会议资料。');
    if(action==='gate'){drawGate();$('gate-dialog').showModal();}
    if(action==='close-gate')$('gate-dialog').close();
    if(action==='close-reset')$('reset-dialog').close();
  });
  document.addEventListener('submit',e=>{if(e.target.id==='fe-form')submitForm(e);if(e.target.id==='quick-form')submitQuick(e);});
  document.addEventListener('input',e=>{if(e.target.closest('#fe-form')&&!e.target.closest('.daily-editor')){
    if(e.target.name==='pm'){pmEdited=true;if(dateDraft)dateDraft.pmSource='manual';}
    handleDateEdit(e.target);markDirty();
  }});
  document.addEventListener('change',e=>{
    if(e.target.name==='flowKind'&&e.target.closest('#quick-form')){newWorkflowKind=e.target.value;$('quick-schedule-field').innerHTML=quickDateField(newWorkflowKind);}
    handleDateEdit(e.target);
    if(e.target.id==='form-module'){const partners=Array.from($('fe-form').querySelectorAll('[name="partner"]:checked')).map(el=>el.value);$('partner-options').innerHTML=partnerOptions(e.target.value,partners);suggestFormPM();}
    if(e.target.name==='partner')suggestFormPM();
    if(e.target.closest('#fe-form')&&!e.target.closest('.daily-editor'))markDirty();
  });
  $('search').addEventListener('input',()=>{
    searchOpened.clear();if($('search').value.trim()){const walk=nodes=>nodes.forEach(n=>{searchOpened.add(n.id);walk(n.children);});walk(groupTree(filtered()));}render();
  });
  $('month').addEventListener('change',()=>tableViews.change({month:$('month').value}));
  $('clear-filters').addEventListener('click',clearFilters);
  $('actor').innerHTML=ACTORS.map(a=>'<option value="'+a.id+'">'+a.name+(a.kind==='pm'?' · '+a.module:'')+'</option>').join('');
  $('actor').addEventListener('change',e=>{const id=e.target.value;$('actor').value=actor.id;requestLeave(()=>changeActor(id));});
  $('new-fe').addEventListener('click',showNew);
  $('detail').addEventListener('close',()=>{selected=null;drawerMode='view';dirty=false;render();});
  $('detail').addEventListener('cancel',e=>{if(dirty){e.preventDefault();requestLeave(()=>{dirty=false;$('detail').close();});}});
  let backdropPointer=null;
  const outsideDetail=event=>{const rect=$('detail').getBoundingClientRect();return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;};
  $('detail').addEventListener('pointerdown',event=>{backdropPointer=event.target===$('detail')&&outsideDetail(event)?event.pointerId:null;});
  $('detail').addEventListener('pointercancel',()=>{backdropPointer=null;});
  $('detail').addEventListener('pointerup',event=>{const close=backdropPointer===event.pointerId&&event.target===$('detail')&&outsideDetail(event);backdropPointer=null;if(close)requestLeave(()=>{dirty=false;$('detail').close();});});
  $('detail').addEventListener('keydown',event=>{const tab=event.target.closest('[role="tab"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...$('detail').querySelectorAll('.detail-tabs [role="tab"]')],i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchDetailTab(tabs[next].dataset.tab);tabs[next].focus();});
  $('confirm-reset').addEventListener('click',()=>{if(save(seed().map(normalizeRecord),{},structuredClone(DATA.dailyUpdates||[]),DATA.sourceRevision,planningRules,window.LubanIntake.initial(),window.LubanReporting.initial())){bookUI.clearDailyDrafts();reportingUI.clear();tableViews.selectAll();changeActor('creator');$('reset-dialog').close();toast('已恢复初始数据');}});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('detail').open){e.preventDefault();$('search').focus();}});
  $('export').addEventListener('click',()=>{
    const values=[['FE 编号','名称','包名','专项','模块','所属 PM','研发负责人','优先级','O','KR','当前状态','进入时间','上线日期','适用流程','研究计划开始','研究计划结束','研究实际开始','研究实际结束',...PERIODS.flatMap(p=>[p.name+'计划进入',p.name+'计划离开',p.name+'实际进入',p.name+'实际离开'])]].concat(filtered().map(r=>[r.code||'',r.title,r.version||'',r.topic,r.modules.join('、'),ACTORS.find(a=>a.id===r.pm)?.name||r.pm||'',r.owner,r.priority,r.okrO,r.okrKR,stateLabel(r),r.entered?time(r.entered):'',r.launchDate,FLOW.definition(r).kind==='research'?'研究任务':'研发发布',...['plannedStart','plannedEnd','actualStart','actualEnd'].map(k=>FLOW.definition(r).kind==='research'?r.researchDates?.[k]||'':''),...PERIODS.flatMap(def=>{const p=FLOW.definition(r).kind==='research'?null:schedule(r).find(x=>x.id===def.id);return p?[p.start,p.end,p.actualStart,p.actualEnd]:['','','',''];})]));
    const csv='\ufeff'+values.map(row=>row.map(v=>{let s=String(v||'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='鲁班FE-'+$('month').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出当前视图 '+filtered().length+' 项 FE');
  });
  planningUI=window.createPlanningUI({esc,icon,getRules:()=>planningRules,saveRules:rules=>save(records,packageReviews,dailyUpdates,appliedSourceRevision,rules),onSaved:fillDateDraft,toast});
  function assertPlanningStateCurrent(){
    let stored;try{stored=localStorage.getItem(STORAGE);}catch{throw new Error('无法读取浏览器数据，请刷新页面后重试。');}
    if(stored!==knownStoredState)throw Object.assign(new Error('其他页面已更新数据，请刷新页面后重新预览。'),{code:'stale-state'});
  }
  planningBatchUI=window.createPlanningBatchUI({esc,icon,toast,getPreview:()=>{assertPlanningStateCurrent();const visible=filtered();return window.LubanPlanningBatch.preview(visible,planningRules,visible.filter(canEdit).map(r=>r.id));},commit:preview=>{
    try{assertPlanningStateCurrent();}catch(error){return {ok:false,stale:true,message:error.message};}
    const visible=filtered(),M=window.LubanPlanningBatch;
    if(!M.matches(preview,visible,planningRules,visible.filter(canEdit).map(r=>r.id)))return {ok:false,stale:true,message:'排期规则、视图或记录已变化，请重新预览。'};
    try{
      const next=M.apply(records,preview),at=now();
      preview.changes.forEach(change=>{const r=next.find(r=>r.id===change.id);r.updated=at;r.history.push({at,actor:actor.name,kind:'change',reason:'按研发排期规则补齐空白计划',text:'自动补齐阶段排期',items:change.updates.map(u=>({label:u.name+'计划进入',before:'',after:u.value}))});});
      return save(next)?{ok:true}:{ok:false,message:'未能保存，预览与原数据已保留，请重试。'};
    }catch(error){return {ok:false,message:error.message||'未能保存排期。'};}
  }});
  flowUI=window.createWorkflowUI({esc,icon,time,today:TODAY,getRecords:()=>records,getActor:()=>actor,canEdit,guard:requestLeave,toast,commit:action=>{
    try{assertPlanningStateCurrent();const next=FLOW.apply(records,action,{actor,editableIds:records.filter(canEdit).map(r=>r.id),today:TODAY,at:now(),uid:()=>crypto.randomUUID()});return save(next.map(normalizeRecord))?{ok:true}:{ok:false,message:'未能保存，当前内容已保留，请重试。'};}catch(error){return {ok:false,message:error.message};}
  },onSaved:id=>{if($('detail').open&&selected===id&&!dirty)drawDetail();bookUI?.refreshOpenPackage?.(id);}});
  function newIntakeFE({id,fields,tasks,demands}){
    const research=fields.flowKind==='research',at=now(),modules=[...new Set(tasks.map(t=>t.module))],owners=[...new Set(tasks.map(t=>t.owner).filter(Boolean))];
    const r=Object.assign(emptyRecord(),{id,title:String(fields.title).trim(),modules,leadModule:modules.length===1?modules[0]:'',pm:'',owner:owners.join('、'),createdBy:actor.id,period:tasks[0].month,entered:at,updated:at,history:[{at,actor:actor.name,actorId:actor.id,text:'从月度RAT任务创建FE'}],description:tasks.map(t=>'### '+t.module+'\n'+(t.story||demands.find(d=>d.id===t.demandId)?.content||'')).join('\n\n'),priority:[...new Set(tasks.map(t=>t.priority).filter(Boolean))].length===1?tasks.find(t=>t.priority)?.priority||'':'',topic:[...new Set(tasks.map(t=>t.topic).filter(Boolean))].length===1?tasks.find(t=>t.topic)?.topic||'':'',launchDate:research?'':fields.launchDate||'',workflow:{kind:research?'research':'release',path:research?FLOW.researchPath.slice():FLOW.releasePath.slice()},stage:research?12:0,sourceRefs:[]});
    if(research)r.researchDates={plannedStart:fields.startDate||'',plannedEnd:fields.researchEnd||'',actualStart:'',actualEnd:''};
    else{dateLinks.edit(r,'phase.development.expectedStart',fields.startDate||'');dateLinks.edit(r,'phase.testing.expectedStart',fields.testDate||'');dateLinks.edit(r,'plan.上线',fields.launchDate||'');if(r.launchDate)applyPlanning(r,'plan.上线');}
    return normalizeRecord(r);
  }
  intakeUI=window.createIntakeUI({esc,icon,stateLabel,ratSource:DATA.ratSource,today:TODAY,modules:MODULES,getState:()=>intakeData,getRecords:()=>records,getArchivedRecords:()=>archivedRecords,getActor:()=>actor,toast,openFE:openDetail,commit:action=>{
    try{assertPlanningStateCurrent();const context={actor,at:now(),today:TODAY,modules:MODULES,reservedFEIds:archivedRecords.map(r=>r.id),uid:()=>crypto.randomUUID(),newFE:newIntakeFE};const result=action.type==='rat-workspace-save'?window.LubanRatWorkspace.save(intakeData,records,action,context):action.type==='rat-review-set'?window.LubanRatWorkspace.setReview(intakeData,records,action,context):action.type==='rat-prepare-month'?window.LubanRatWorkspace.prepareMonth(intakeData,records,action.month,context):action.type==='rat-import'?window.LubanRat.importSource(intakeData,records,DATA.ratSource,context):action.type==='review-and-admit'?window.LubanRat.approve(intakeData,records,action,context):window.LubanIntake.apply(intakeData,records,action,context);return save(result.records,packageReviews,dailyUpdates,appliedSourceRevision,planningRules,result.intake)?{ok:true}:{ok:false,message:'未能保存，当前输入已保留，请重试。'};}catch(error){return {ok:false,message:error.message||'未能保存'};}
  }});
  reportingUI=window.createReportingUI({esc,states:STATES,today:TODAY,sourceRows:DATA.sourceRows,getRecords:()=>records,getState:()=>reportingData,getDailyUpdates:()=>dailyUpdates,getActor:()=>actor,canEdit,toast,openFE:openDetail,openFlow:openState,commit:action=>{
    try{assertPlanningStateCurrent();const result=window.LubanReporting.apply(reportingData,records,dailyUpdates,action,{actor,at:now(),today:TODAY,uid:()=>crypto.randomUUID(),canEdit});return save(result.records.map(normalizeRecord),packageReviews,result.daily,appliedSourceRevision,planningRules,intakeData,result.reporting)?{ok:true}:{ok:false,message:'未能保存，当前输入已保留，请重试。'};}catch(error){return {ok:false,message:error.message||'未能保存'};}
  }});
  bookUI=window.createWorkbookUI({reportingUI,intakeUI,planningUI,workflowOpen:openState,workflowSummary:r=>flowUI.summary(r),data:DATA,esc,icon,time,today:TODAY,states:STATES,getRecords:()=>records,getActor:()=>actor,getReviews:()=>packageReviews,getDailyUpdates:()=>dailyUpdates,getSelectedId:()=>selected,save,openDetail,toast,canEdit,requestLeave,pmName:value=>ACTORS.find(a=>a.id===value)?.name||value||'',onProgressSaved:(r,{progressSaved=false}={})=>{
    if(progressSaved&&$('detail').open&&selected===r.id&&!dirty){progressEditing=false;$('detail').close();return;}
    progressEditing=false;if($('panel-overview'))$('panel-overview').innerHTML=overviewMarkup(r);
    if(progressSaved&&dirty){$('draft-label').textContent='今日进展已保存，另有未保存的信息修改';toast('今日进展已保存，另有信息草稿尚未保存');}
    if(detailTab==='overview'){
      $('detail').querySelector('.detail-footer [data-action="daily-save"]')?.setAttribute('hidden','');
      if(!dirty)$('draft-label').textContent='今日进展已保存';
      $('panel-overview').querySelector('[data-action="quick-progress"]')?.focus({preventScroll:true});
    }
  }});
  fieldAdapter=window.createFEViewFields({getRecords:()=>records,getDailyUpdates:()=>dailyUpdates,states:STATES,sourceRows:DATA.sourceRows,stateLabel,dateValue:dateLinks.get,localDate,pmName:value=>ACTORS.find(a=>a.id===value)?.name||value||'',attention,attentionCompare:(a,b)=>Number(isDone(a))-Number(isDone(b))||Number(attention(b))-Number(attention(a))||overdue(b)-overdue(a)});
  const readPreference=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const initialViews=viewModel.initial(COLUMNS,readPreference(PREFS),readPreference(GROUP_PREFS));
  tableViews=window.createTableViews({fields:fieldAdapter.fields,columns:COLUMNS,initial:initialViews,storageKey:STORAGE+'-table-views',escape:esc,icon,toast,
    count:config=>viewModel.filter(scoped(config),config.filters,fieldAdapter.fields,fieldAdapter.context()).length,
    onChange:({switched}={})=>{if(switched){$('search').value='';searchOpened.clear();}$('month').value=settings().month;render();}
  });
  $('month').value=settings().month;fillIcons();render();
})();
