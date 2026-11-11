import { marked } from 'marked';
import DOMPurify from 'dompurify';
const clean=html=>DOMPurify.sanitize(String(html||''),{ALLOWED_TAGS:['p','br','div','strong','b','em','i','u','s','ul','ol','li','a','blockquote','h2','h3','h4','code','pre','hr','span','table','thead','tbody','tr','th','td'],ALLOWED_ATTR:['href','title','target','rel'],ALLOW_DATA_ATTR:false});
window.LubanRichText={
  clean,
  text(html){const t=document.createElement('div');t.innerHTML=clean(html);t.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));t.querySelectorAll('p,div,li,h2,h3,h4,blockquote,tr').forEach(n=>n.append('\n'));return t.textContent.replace(/\n{3,}/g,'\n\n').trim();},
  fromText(value){return String(value??'').split('\n').map(line=>'<p>'+line.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p>').join('');}
};
window.LubanMarkdown={render(value){
  const html=DOMPurify.sanitize(marked.parse(String(value||''),{async:false,gfm:true,breaks:true}),{FORBID_TAGS:['style','form','input','button','iframe'],FORBID_ATTR:['style']});
  const template=document.createElement('template');template.innerHTML=html;
  template.content.querySelectorAll('a').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});
  return template.innerHTML;
}};
