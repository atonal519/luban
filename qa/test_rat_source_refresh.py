import json,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class RatSourceRefresh(unittest.TestCase):
 def run_js(self,body):
  script="""globalThis.window={};await import('./src/fe-board/intake/model.js');await import('./src/fe-board/intake/rat-model.js');
const M=window.LubanRat;let n=0;const ctx={actor:{id:'creator',kind:'creator',name:'维护人'},at:'2026-11-09T12:00:00Z',modules:['监管云','感知','运维'],uid:()=>String(++n),newFE:({id,fields})=>({id,title:fields.title,stage:0,history:[],phaseDates:{}})};
const old={month:'2026-11',sheet:'11月RAT',sourceName:'RAT.xlsx',revision:'old',resourceHomeModules:{甲:'监管云',乙:'感知'},rows:[{row:101,cells:{B:'旧工作',G:'监管云',H:'甲',J:'10',I:'通过',E:'T0',R:'原备注'}},{row:102,cells:{B:'另一个',G:'感知',H:'乙',J:'3',I:'不通过'}}]};
const newer=structuredClone(old);newer.revision='new';newer.resourceHomeModules.丙='监管云';Object.assign(newer.rows[0].cells,{B:'新名称',G:'监管云,运维',H:'甲,丙',E:'T1',K:'2026-11-09',R:'新备注'});
function base(){return M.importSource(window.LubanIntake.initial(),[],old,ctx);}
"""+body
  p=subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,text=True,capture_output=True)
  self.assertEqual(p.returncode,0,p.stderr);return json.loads(p.stdout)

 def test_source_refresh_updates_untouched_fields_once_without_changing_ids_or_execution(self):
  x=self.run_js("const a=base(),t=a.intake.tasks[0],d=a.intake.demands[0];a.records[0].stage=2;a.records[0].phaseDates={testing:{actualStart:'2026-11-07'}};const before=JSON.stringify(a),b=M.importSource(a.intake,a.records,newer,ctx),u=b.intake.tasks[0],after=M.importSource(b.intake,b.records,newer,ctx);console.log(JSON.stringify({needed:M.needsImport(a.intake,newer),sameIds:[u.id,u.demandId,u.feId].join() === [t.id,t.demandId,t.feId].join(),fields:[u.title,u.owner,u.modules,u.priority,u.schemeDate,u.notes],content:b.intake.demands[0].content,reviews:b.intake.tasks.map(t=>t.review.result),records:JSON.stringify(a.records)===JSON.stringify(b.records),inputSame:before===JSON.stringify(a),idempotent:JSON.stringify(b)===JSON.stringify(after),complete:!M.needsImport(b.intake,newer)}))")
  self.assertTrue(x['needed']);self.assertTrue(x['sameIds'])
  self.assertEqual(x['fields'],['新名称','甲,丙',['监管云','运维'],'T1','2026-11-09','新备注'])
  self.assertEqual(x['content'],'新名称');self.assertEqual(x['reviews'],['passed','rejected'])
  for key in ['records','inputSame','idempotent','complete']:self.assertTrue(x[key],key)

 def test_manual_assignments_monthly_overrides_and_explicit_empty_review_survive(self):
  x=self.run_js("const a=base(),t=a.intake.tasks[0],d=a.intake.demands[0];t.effort='12';t.priority='T2';t.notes='手写备注';t.review=null;t.reviewExplicit=true;d.content='手工名称';d.monthlyFields={'2026-11':{priority:'',notesText:'手工月度备注',sourceDetails:{text:'',images:[],links:[]}}};d.classificationTags=['自建标签'];const monthly=JSON.stringify(d.monthlyFields);delete a.intake.ratSourceRevisions;const b=M.importSource(a.intake,a.records,newer,ctx),u=b.intake.tasks[0],v=b.intake.demands[0];console.log(JSON.stringify({owner:u.owner,effort:u.effort,priority:u.priority,notes:u.notes,review:u.review,explicit:u.reviewExplicit,content:v.content,monthly:JSON.stringify(v.monthlyFields)===monthly,tags:v.classificationTags,scheme:u.schemeDate,raw:u.sourceRat.cells.H}))")
  self.assertEqual(x,{'owner':'甲','effort':'12','priority':'T2','notes':'手写备注','review':None,'explicit':True,'content':'手工名称','monthly':True,'tags':['自建标签'],'scheme':'2026-11-09','raw':'甲,丙'})

 def test_independent_allocations_other_months_and_manual_work_are_retained(self):
  x=self.run_js("const a=base(),t=a.intake.tasks[0];t.allocations=[{key:'one',owner:'手改人员',effort:'8',modules:['监管云']}];const dec={...structuredClone(t),id:'dec',month:'2026-12',owner:'下月人员',effort:'',sourceRat:undefined};a.intake.tasks.push(dec,{id:'manual',demandId:'手工需求',month:'2026-11',title:'手工新增',owner:'自填',effort:'10'});const untouched=JSON.stringify(a.intake.tasks.slice(2)),allocation=JSON.stringify(t.allocations);const b=M.importSource(a.intake,a.records,newer,ctx);console.log(JSON.stringify({extra:JSON.stringify(b.intake.tasks.slice(2))===untouched,allocation:JSON.stringify(b.intake.tasks[0].allocations)===allocation,count:b.intake.tasks.length}))")
  self.assertEqual(x,{'extra':True,'allocation':True,'count':4})

 def test_fresh_and_refreshed_administrative_modules_stay_stable(self):
  x=self.run_js("const a=base(),b=M.importSource(a.intake,a.records,newer,ctx),fresh=M.importSource(window.LubanIntake.initial(),[],newer,ctx);console.log(JSON.stringify([b,fresh].map(v=>M.resources(v.intake,'2026-11').people.map(p=>({name:p.name,home:p.homeModule,days:p.days})).filter(p=>p.name!=='乙'))))")
  for people in x:self.assertEqual({p['name']:(p['home'],p['days']) for p in people},{'甲':('监管云',5),'丙':('监管云',5)})
