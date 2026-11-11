/* Organization defaults are suggestions, never approval identities. */
(() => {
  const roster={};
  function recommend(r){
    if(r.leadModule&&roster[r.leadModule])return roster[r.leadModule];
    const modules=r.modules||[];if(!modules.length||modules.some(m=>!roster[m]))return '';
    const names=[...new Set(modules.map(m=>roster[m]))];return names.length===1?names[0]:'';
  }
  function fill(record){
    const r=structuredClone(record);
    if(String(r.pm||'').trim()||r.pmSource==='manual')return r;
    const suggested=recommend(r);if(suggested){r.pm=suggested;r.pmSource='module';}
    return r;
  }
  window.LubanPMDirectory={roster,recommend,fill};
})();
