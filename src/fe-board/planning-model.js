/* Optional working-day intervals fill only missing planned entry dates. */
(() => {
  const nodes=[
    {name:'开发',path:'phase.development.expectedStart'},
    {name:'测试',path:'phase.testing.expectedStart'},
    {name:'单车',path:'plan.单车'},
    {name:'编组',path:'plan.编组'},
    {name:'灰度',path:'plan.灰度'},
    {name:'上线',path:'plan.上线'}
  ];
  function normalizeRules(value={}){
    const gaps=Array.from({length:5},(_,i)=>{
      const raw=value?.gaps?.[i];if(raw===null||raw===undefined||raw==='')return null;
      const n=Number(raw);if(!Number.isInteger(n)||n<0||n>3650)throw new Error('间隔请填写 0～3650 的整数，或留空。');
      return n;
    });
    return {version:1,gaps};
  }
  function addWorkingDays(value,count){
    const stamp=Date.parse(value+'T12:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==value||!Number.isInteger(count)||Math.abs(count)>3650)throw new Error('日期或工作日间隔无效。');
    const day=new Date(stamp),step=Math.sign(count);let remaining=Math.abs(count);
    while(remaining){day.setUTCDate(day.getUTCDate()+step);if(![0,6].includes(day.getUTCDay()))remaining--;}
    return day.toISOString().slice(0,10);
  }
  function get(record,path){
    const [kind,id,field]=path.split('.');
    return kind==='plan'?record.productionPlans?.[id]||'':record.phaseDates?.[id]?.[field]||'';
  }
  function planUpdates(record,rules,anchor){
    if(record.workflow?.kind==='research')return [];
    const allowed=node=>!record.workflow?.path||record.workflow.path.includes(({development:1,testing:3,'单车':4,'编组':5,'灰度':6,'上线':8})[node.path.split('.')[1]]);
    const start=nodes.findIndex(n=>n.path===anchor);if(start<0||!allowed(nodes[start])||!get(record,anchor))return [];
    const {gaps}=normalizeRules(rules),original=nodes.map(n=>get(record,n.path)),dates=original.slice();
    const anchors=[start,...nodes.map((_,i)=>i).filter(i=>i!==start&&original[i]&&allowed(nodes[i]))];
    for(const a of anchors)for(const step of [-1,1]){
      let index=a;
      while(index+step>=0&&index+step<nodes.length){
        let next=index+step;while(next>=0&&next<nodes.length&&!allowed(nodes[next]))next+=step;if(next<0||next>=nodes.length)break;const stage=n=>({development:1,testing:3,'单车':4,'编组':5,'灰度':6,'上线':8})[n.path.split('.')[1]],key=stage(nodes[Math.min(index,next)])+'>'+stage(nodes[Math.max(index,next)]),custom=record.workflow?.planGaps?.[key];const gap=custom!==undefined?custom:Math.abs(index-next)===1?gaps[Math.min(index,next)]:null;if(gap===null)break;
        if(!dates[next])dates[next]=addWorkingDays(dates[index],gap*step);
        index=next;
      }
    }
    return nodes.flatMap((n,i)=>allowed(n)&&!original[i]&&dates[i]?[{path:n.path,value:dates[i],name:n.name}]:[]);
  }
  window.LubanPlanning={nodes,normalizeRules,addWorkingDays,planUpdates};
})();
