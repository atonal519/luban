/* Data-only table operations. Fields declare their capabilities; views only reference IDs. */
(() => {
  const operators={eq:'等于',ne:'不等于',contains:'包含',not_contains:'不包含'};
  const flat=v=>v==null?[]:Array.isArray(v)?v.flatMap(flat):typeof v==='object'?Object.values(v).flatMap(flat):[String(v)];
  const text=v=>String(v??'').replace(/\r\n?/g,'\n').trim().toLocaleLowerCase();
  const collator=new Intl.Collator('zh-CN',{numeric:true,sensitivity:'base'});
  function match(value,op,query){
    const values=flat(value).map(text),q=text(query);
    const equal=q?values.some(v=>v===q):values.every(v=>!v);
    const includes=values.some(v=>v.includes(q));
    if(op==='eq')return equal;if(op==='ne')return !equal;
    if(op==='contains')return includes;if(op==='not_contains')return !includes;
    throw new Error('不支持的筛选方式');
  }
  const find=(fields,id)=>fields.find(f=>f.id===id);
  function filter(rows,rules,fields,context){
    return rows.filter(r=>rules.every(rule=>{
      const f=find(fields,rule.field);if(!f?.filterable)throw new Error('筛选字段不可用');
      return match(f.value(r,context),rule.op,rule.value);
    }));
  }
  function sort(rows,rules,fields,context){
    return rows.slice().sort((a,b)=>{
      for(const rule of rules){
        const f=find(fields,rule.field);if(!f)continue;
        const av=flat(f.value(a,context)).join('、'),bv=flat(f.value(b,context)).join('、');
        if(!av!==!bv)return av?-1:1;
        const delta=f.compare?f.compare(a,b,context):collator.compare(av,bv);
        if(delta)return delta*(rule.direction==='desc'?-1:1);
      }
      return String(a.id).localeCompare(String(b.id));
    });
  }
  function group(rows,rules,fields,context,path=[]){
    if(!rules.length)return [];
    const [rule,...rest]=rules,f=find(fields,rule.field);if(!f?.groupable)throw new Error('此字段不支持分组');
    const buckets=new Map();
    rows.forEach(r=>{
      const value=f.group?f.group(r,context):{key:String(f.value(r,context)??''),label:String(f.value(r,context)??'')};
      const key=String(value.key??'');
      if(!buckets.has(key))buckets.set(key,{key,label:value.label||f.emptyLabel||'未填写',rank:value.rank,records:[]});
      buckets.get(key).records.push(r);
    });
    return [...buckets.values()].sort((a,b)=>{
      if(!a.key!==!b.key)return a.key?-1:1;
      const delta=a.rank!=null&&b.rank!=null?a.rank-b.rank:collator.compare(a.label,b.label);
      return delta*(rule.direction==='desc'?-1:1);
    }).map(bucket=>{
      const nextPath=[...path,[f.id,bucket.key]],id=JSON.stringify(nextPath);
      return {...bucket,id,field:f.id,total:f.total?.(bucket.key,context),children:group(bucket.records,rest,fields,context,nextPath)};
    });
  }
  function validate(view,fields,columns){
    if(!view||!view.id||!String(view.name||'').trim()||String(view.name).length>60)throw new Error('请填写视图名称，最多 60 字');
    if(['filters','groups','sorts','closed'].some(key=>!Array.isArray(view[key]))||view.closed.some(id=>typeof id!=='string')||typeof view.month!=='string')throw new Error('视图配置不完整，请重新设置');
    if(!['all','rd','mine','attention','done'].includes(view.scope))throw new Error('视图范围不可用');
    if(!Array.isArray(view.columns)||view.columns.some(id=>!columns.some(c=>c.id===id))||new Set(view.columns).size!==view.columns.length)throw new Error('显示字段不可用');
    if(columns.some(c=>c.fixed&&!view.columns.includes(c.id))||view.columns[0]!=='title')throw new Error('请保留 FE 名称和当前阶段，FE 名称需在首列');
    for(const rule of view.filters||[]){
      if(!find(fields,rule.field)?.filterable||!Object.hasOwn(operators,rule.op))throw new Error('筛选条件不可用');
      if(['contains','not_contains'].includes(rule.op)&&!text(rule.value))throw new Error('包含或不包含条件需要关键词；筛选未填写请使用等于并留空');
    }
    const grouped=new Set();
    for(const rule of view.groups||[]){if(!find(fields,rule.field)?.groupable||grouped.has(rule.field))throw new Error('分组字段不可用或重复');grouped.add(rule.field);if(!['asc','desc'].includes(rule.direction))throw new Error('分组顺序不可用');}
    for(const rule of view.sorts||[]){if(!find(fields,rule.field)||!['asc','desc'].includes(rule.direction))throw new Error('排序条件不可用');}
  }
  function initial(columns,columnPref,groupPref){
    const saved=Array.isArray(columnPref)?columnPref:columnPref?.columns;
    const legacy=Array.isArray(columnPref)&&!columnPref.some(id=>String(id).startsWith('schedule-'));
    const chosen=Array.isArray(saved)?columns.filter(c=>c.fixed||saved.includes(c.id)||Array.isArray(columnPref)&&c.id==='package'||legacy&&(c.base||c.period)).map(c=>c.id):columns.map(c=>c.id);
    const mode=groupPref?.mode||'stage-package';
    const groups=mode==='none'?[]:mode==='package'?[{field:'package',direction:'asc'}]:[{field:'packageStage',direction:'asc'},{field:'package',direction:'asc'}];
    const base={columns:chosen,filters:[],groups,sorts:[{field:'attention',direction:'asc'}],closed:[],month:'all'};
    return {version:1,activeId:'all',views:[['all','全部 FE'],['rd','研发跟进'],['mine','我负责'],['attention','需关注'],['done','已完成']].map(([id,name])=>({...structuredClone(base),id,name,scope:id,system:true,...(id==='rd'?{groups:[]}: {})}))};
  }
  window.LubanTableViewModel={operators,flat,match,filter,sort,group,validate,initial};
})();
