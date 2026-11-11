/* Preview only until the injected commit succeeds. Storage stays in the app. */
window.createPlanningBatchUI=function(ctx){
  const {esc:e,icon,getPreview,commit,toast}=ctx,$=id=>document.getElementById(id),M=window.LubanPlanningBatch,P=window.LubanPlanning;
  let result=null;
  function paint(){
    const reasons=[...new Set(result.skipped.map(r=>r.reason))];
    $('planning-preview-dialog').innerHTML='<div class="modal-heading"><h2 id="planning-preview-title">自动排期预览</h2><button type="button" class="btn icon-button" data-action="planning-preview-close" aria-label="关闭排期预览">'+icon('close')+'</button></div><div class="modal-body"><div class="planning-preview-summary"><strong>当前视图 '+result.total+' 条</strong><span>可补齐 '+result.changes.length+' 条记录 · '+result.dateCount+' 个日期</span><button type="button" class="text-button" data-action="planning-open">排期规则</button></div><p class="planning-preview-legend"><i aria-hidden="true"></i>蓝色日期为本次补齐，已有计划保留；实际日期与阶段不变。</p>'+(result.changes.length?'<div class="planning-preview-table-wrap"><table class="planning-preview-table"><thead><tr><th>FE／发布内容</th>'+P.nodes.map(n=>'<th>'+n.name+'</th>').join('')+'</tr></thead><tbody>'+result.changes.map(row=>'<tr data-preview-fe="'+e(row.id)+'"><th scope="row"><strong title="'+e(row.title)+'">'+e(row.title)+'</strong><small>'+e(row.version||'未关联包')+'</small></th>'+P.nodes.map((n,i)=>{const update=row.updates.find(u=>u.path===n.path);return '<td class="'+(update?'planning-date-added':'')+'">'+e(update?.value||row.values[i]||'—')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table></div><p class="planning-preview-scroll">可横向滚动查看全部阶段</p>':'<p class="planning-preview-empty">当前没有可补齐的日期。</p>')+(result.skipped.length?'<details class="planning-preview-skipped"><summary>'+result.skipped.length+' 条未修改 · 查看原因</summary>'+reasons.map(reason=>'<div><strong>'+e(M.reasons[reason])+' · '+result.skipped.filter(r=>r.reason===reason).length+' 条</strong><p>'+result.skipped.filter(r=>r.reason===reason).map(r=>e(r.title)).join('；')+'</p></div>').join('')+'</details>':'')+'<p class="field-error" id="planning-preview-error" role="alert"></p></div><div class="modal-footer"><span class="footer-note">'+(result.dateCount?'保存后写入本次补齐及变更记录。':'展开“未修改”可查看原因。')+'</span><button type="button" class="btn" data-action="planning-preview-close">取消</button><button type="button" class="btn" data-action="planning-preview-refresh">重新预览</button><button type="button" class="btn primary" data-action="planning-preview-save" '+(!result.dateCount?'disabled':'')+'>保存排期</button></div>';
  }
  function refresh(){try{result=getPreview();paint();return true;}catch(error){if($('planning-preview-dialog').open){$('planning-preview-error').textContent=error.message;$('planning-preview-dialog').querySelector('[data-action="planning-preview-save"]').disabled=true;}else toast(error.message||'未能生成预览。',true);return false;}}
  function open(){if(refresh()&&!$('planning-preview-dialog').open)$('planning-preview-dialog').showModal();}
  function handleClick(button){
    const action=button.dataset.action;
    if(action==='planning-preview'){open();return true;}
    if(action==='planning-preview-close'){$('planning-preview-dialog').close();return true;}
    if(action==='planning-preview-refresh'){refresh();return true;}
    if(action==='planning-preview-save'){
      if(!result?.dateCount)return true;
      const status=commit(result);
      if(!status.ok){$('planning-preview-error').textContent=status.message;if(status.stale)button.disabled=true;return true;}
      $('planning-preview-dialog').close();toast('已补齐 '+result.changes.length+' 条记录、'+result.dateCount+' 个计划日期');return true;
    }
    return false;
  }
  return {handleClick};
};
