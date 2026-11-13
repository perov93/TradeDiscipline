const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const block=source.slice(source.indexOf("const checklistForm="),source.indexOf("const countdowns="));

function setup(initial){
  const inputs=initial.map(checked=>({checked}));
  const segments=initial.map(()=>({
    filled:false,
    classList:{toggle(name,value){this.owner.filled=value}}
  }));
  segments.forEach(segment=>{segment.classList.owner=segment});
  const listeners={};
  const form={
    querySelectorAll:()=>inputs,
    addEventListener:(event,callback)=>{listeners[event]=callback}
  };
  const progress={
    value:null,
    querySelectorAll:()=>segments,
    setAttribute:(name,value)=>{if(name==='aria-valuenow')progress.value=value}
  };
  const summaryValue={textContent:''},count={textContent:''};
  const elements={checklistForm:form,checklistProgress:progress,checklistProgressValue:summaryValue,checklistCount:count};
  const timers=[];
  vm.runInNewContext(block,{
    document:{getElementById:id=>elements[id]},
    setTimeout:callback=>timers.push(callback)
  });
  return {inputs,segments,progress,summaryValue,count,listeners,timers};
}

test('checklist counts and segments follow checkbox changes without submitting',()=>{
  const ui=setup([true,false,false]);
  assert.equal(ui.summaryValue.textContent,'1 of 3');
  assert.equal(ui.progress.value,'1');
  assert.deepEqual(ui.segments.map(segment=>segment.filled),[true,false,false]);
  ui.inputs[2].checked=true;
  ui.listeners.change();
  assert.equal(ui.count.textContent,'2 OF 3');
  assert.equal(ui.summaryValue.textContent,'2 of 3');
  assert.equal(ui.progress.value,'2');
  assert.deepEqual(ui.segments.map(segment=>segment.filled),[true,true,false]);
  ui.inputs[0].checked=false;
  ui.listeners.change();
  assert.equal(ui.count.textContent,'1 OF 3');
  assert.deepEqual(ui.segments.map(segment=>segment.filled),[true,false,false]);
  ui.listeners.reset();
  ui.inputs[0].checked=true;
  ui.inputs[2].checked=false;
  ui.timers[0]();
  assert.equal(ui.progress.value,'1');
});

test('empty checklist displays zero progress',()=>{
  const ui=setup([]);
  assert.equal(ui.count.textContent,'0 OF 0');
  assert.equal(ui.progress.value,'0');
  assert.equal(ui.segments.length,0);
});
