const setupDeleteDialog=document.getElementById('setupDeleteDialog');
if(setupDeleteDialog){
  const name=setupDeleteDialog.querySelector('[data-setup-delete-name]');
  const form=setupDeleteDialog.querySelector('[data-setup-delete-form]');
  const title=document.getElementById('setupDeleteTitle');
  const impact=setupDeleteDialog.querySelector('[data-delete-impact]');
  const confirmButton=form.querySelector('button[type="submit"]');
  const approved=new WeakSet();
  let pending=null;
  const open=(kind,label,media)=>{
    title.textContent=`Delete this ${kind}?`;
    name.textContent=label;
    impact.textContent=media?' and its uploaded media':'';
    confirmButton.textContent=`Delete ${kind}`;
    setupDeleteDialog.showModal();
  };
  setupDeleteDialog.addEventListener('close',()=>{pending=null});
  setupDeleteDialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();
      setupDeleteDialog.close();
    }
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-setup-delete]');
    if(button){
      pending=null;
      form.action=button.dataset.setupDelete;
      open('example',button.dataset.setupTitle,true);
    }
  });
  document.addEventListener('submit',event=>{
    const original=event.target;
    if(!original.matches('form[data-delete-kind]')||event.defaultPrevented)return;
    if(approved.has(original)){
      approved.delete(original);
      return;
    }
    event.preventDefault();
    pending={form:original,submitter:event.submitter};
    open(original.dataset.deleteKind,original.dataset.deleteName,original.dataset.deleteKind==='trade');
  });
  form.addEventListener('submit',event=>{
    if(!pending)return;
    event.preventDefault();
    const original=pending;
    setupDeleteDialog.close();
    pending=null;
    approved.add(original.form);
    try{
      if(original.submitter)original.form.requestSubmit(original.submitter);
      else original.form.requestSubmit();
    }finally{
      approved.delete(original.form);
    }
  });
}
const openRecordEditor=dialog=>{
  dialog.showModal();
  dialog.querySelector('input:not([type="hidden"])').focus();
};
document.querySelectorAll('[data-edit-dialog]').forEach(button=>{
  button.addEventListener('click',()=>{
    const dialog=document.getElementById(button.dataset.editDialog);
    openRecordEditor(dialog);
  });
});
document.querySelectorAll('[data-record-editor], #ruleDialog, #tradeDialog').forEach(dialog=>{
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();
      dialog.close();
    }
  });
  if(dialog.dataset.openOnLoad==='true'){
    document.addEventListener('DOMContentLoaded',()=>openRecordEditor(dialog),{once:true});
  }
});
