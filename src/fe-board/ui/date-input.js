/* The entire date field opens its picker; manual keyboard input remains available. */
document.addEventListener('click',event=>{
  const input=event.target.closest('input[type="date"],input[type="datetime-local"]');
  if(!input||!event.isTrusted||input.readOnly||input.matches(':disabled')||typeof input.showPicker!=='function')return;
  try{input.showPicker();}catch{/* The native indicator remains usable when an embedded browser limits this API. */}
});
