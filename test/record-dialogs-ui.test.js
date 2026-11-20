const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function element(){
  const handlers={};
  return {
    dataset:{},textContent:'',value:'',open:false,
    addEventListener(type,handler){(handlers[type]||=[]).push(handler)},
    emit(type,event={}){for(const handler of handlers[type]||[])handler(event)},
    showModal(){this.open=true},
    close(){this.open=false;this.emit('close')},
    focus(){this.focused=true}
  };
}
function setup(autoOpen=false){
  const document=element();
  const dialog=element(),form=element(),name=element(),impact=element(),title=element(),confirm=element();
  const editor=element(),input=element(),editButton=element();
  editButton.dataset.editDialog='exampleEditor';
  editor.dataset.openOnLoad=String(autoOpen);
  editor.querySelector=()=>input;
  document.getElementById=id=>({setupDeleteDialog:dialog,setupDeleteTitle:title,exampleEditor:editor})[id];
  document.querySelectorAll=selector=>selector==='[data-edit-dialog]'?[editButton]:[editor];
  dialog.querySelector=selector=>({
    '[data-setup-delete-name]':name,'[data-setup-delete-form]':form,'[data-delete-impact]':impact
  })[selector];
  form.querySelector=()=>confirm;
  const event=target=>({target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true}});
  const submit=(target,submitter)=>{
    const submission=Object.assign(event(target),{submitter});
    target.emit('submit',submission);
    document.emit('submit',submission);
    if(!submission.defaultPrevented)target.posts=(target.posts||0)+1;
    return submission;
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public','setup-library-ui.js'),'utf8'),{document});
  const original=kind=>{
    const record=element();
    record.dataset={deleteKind:kind,deleteName:`Saved ${kind} <test>`};
    record.matches=selector=>selector==='form[data-delete-kind]';
    record.requestSubmit=submitter=>{record.submitter=submitter;submit(record,submitter)};
    return record;
  };
  form.matches=()=>false;
  return {document,dialog,form,name,impact,title,confirm,submit,original,event,editor,input,editButton};
}

test('dynamic record deletions require confirmation, support cancellation, and submit the original form once',()=>{
  const ui=setup();
  for(const kind of ['rule','trade','no-setup entry']){
    const original=ui.original(kind),submitter={};
    original.action=`/${kind}/record/delete`;
    original.csrf='original-token';
    original.returnTo='calendar';
    original.returnDate='2026-11-19';
    assert.equal(ui.submit(original,submitter).defaultPrevented,true);
    assert.equal(original.posts,undefined);
    assert.equal(ui.dialog.open,true);
    assert.equal(ui.title.textContent,`Delete this ${kind}?`);
    assert.equal(ui.name.textContent,`Saved ${kind} <test>`);
    assert.equal(ui.impact.textContent,kind==='trade'?' and its uploaded media':'');
    ui.dialog.close();
    assert.equal(original.posts,undefined);
    ui.submit(original,submitter);
    ui.submit(ui.form);
    assert.equal(ui.dialog.open,false);
    assert.equal(original.posts,1);
    assert.equal(ui.form.posts,undefined);
    assert.equal(original.submitter,submitter);
    assert.equal(original.action,`/${kind}/record/delete`);
    assert.equal(original.csrf,'original-token');
    assert.equal(original.returnTo,'calendar');
    assert.equal(original.returnDate,'2026-11-19');
    assert.equal(ui.submit(original,submitter).defaultPrevented,true);
    assert.equal(original.posts,1);
    ui.dialog.close();
  }
});

test('Escape cancels deletion and a subsequent example button uses its own endpoint and name',()=>{
  const ui=setup(),original=ui.original('rule');
  ui.submit(original);
  const escape=Object.assign(ui.event(ui.dialog),{key:'Escape'});
  ui.dialog.emit('keydown',escape);
  assert.equal(escape.defaultPrevented,true);
  assert.equal(ui.dialog.open,false);
  assert.equal(original.posts,undefined);
  const button={dataset:{setupDelete:'/setups/example-2/delete',setupTitle:'Example <two>'}};
  ui.document.emit('click',{target:{closest:()=>button}});
  assert.equal(ui.name.textContent,'Example <two>');
  assert.equal(ui.form.action,'/setups/example-2/delete');
  ui.submit(ui.form);
  assert.equal(ui.form.posts,1);
  assert.equal(original.posts,undefined);
});

test('an original form that fails validation does not keep a confirmation bypass',()=>{
  const ui=setup(),original=ui.original('trade');
  original.requestSubmit=()=>{};
  ui.submit(original);
  ui.submit(ui.form);
  assert.equal(ui.submit(original).defaultPrevented,true);
  assert.equal(original.posts,undefined);
});

test('example editors open as dialogs, focus their first field and close from the backdrop',()=>{
  const ui=setup();
  ui.editButton.emit('click');
  assert.equal(ui.editor.open,true);
  assert.equal(ui.input.focused,true);
  ui.editor.emit('click',{target:ui.input});
  assert.equal(ui.editor.open,true);
  ui.editor.emit('click',{target:ui.editor});
  assert.equal(ui.editor.open,false);
  ui.editButton.emit('click');
  const escape=Object.assign(ui.event(ui.editor),{key:'Escape'});
  ui.editor.emit('keydown',escape);
  assert.equal(escape.defaultPrevented,true);
  assert.equal(ui.editor.open,false);
});

test('library edit links wait for dashboard initialization before opening and focusing the selected editor',()=>{
  const ui=setup(true);
  assert.equal(ui.editor.open,false);
  ui.document.emit('DOMContentLoaded');
  assert.equal(ui.editor.open,true);
  assert.equal(ui.input.focused,true);
});

test('no-setup modal populates the selected record, preserves return targets and updates the return date',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const nodes=Object.fromEntries([
    'noSetupEditor','noSetupReturnTo','noSetupReturnDate','noSetupDate','noSetupNotes','noSetupDialog'
  ].map(id=>[id,element()]));
  const button=element();
  button.dataset={entryId:'one',returnTo:'journal'};
  const context=vm.createContext({
    noSetupEntries:[{id:'one',date:'2026-11-18',notes:'Original <notes>'},{id:'two',date:'2026-11-19'}],
    document:{getElementById:id=>nodes[id],querySelectorAll:()=>[button]}
  });
  vm.runInContext(source.slice(source.indexOf('function editNoSetup('),source.indexOf("document.querySelectorAll('.trade-edit-trigger')")),context);
  button.emit('click');
  assert.equal(nodes.noSetupDialog.open,true);
  assert.equal(nodes.noSetupEditor.action,'/no-setup/one/edit');
  assert.equal(nodes.noSetupNotes.value,'Original <notes>');
  assert.equal(nodes.noSetupReturnTo.value,'journal');
  assert.equal(nodes.noSetupReturnDate.value,'2026-11-18');
  assert.equal(nodes.noSetupDate.focused,true);
  nodes.noSetupDate.emit('change',{target:{value:'2026-11-20'}});
  assert.equal(nodes.noSetupReturnDate.value,'2026-11-20');
  context.editNoSetup('two','calendar');
  assert.equal(nodes.noSetupEditor.action,'/no-setup/two/edit');
  assert.equal(nodes.noSetupNotes.value,'');
  assert.equal(nodes.noSetupReturnTo.value,'calendar');
  assert.equal(nodes.noSetupDate.value,'2026-11-19');
  assert.throws(()=>context.editNoSetup('missing'),/not available for editing/);
});
