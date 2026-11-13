const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function field(value){
  return{
    value,handlers:{},
    addEventListener(event,callback){this.handlers[event]=callback},
    emit(event){this.handlers[event]()}
  };
}

test('outcome and P&L conflicts are explained and require confirmation',()=>{
  const outcome=field('WIN');
  const pnl=field('-12');
  const warning={hidden:true,textContent:''};
  const handlers={};
  const form={
    querySelector(selector){
      if(selector==='[name="outcome"]')return outcome;
      if(selector==='[name="pnl"]')return pnl;
      return warning;
    },
    addEventListener(event,callback){handlers[event]=callback}
  };
  let confirmed=false;
  const document={querySelectorAll:selector=>selector==='[data-outcome-pnl]'?[form]:[]};
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('function outcomePnlMismatch('),source.indexOf("document.querySelectorAll('form[data-confirm]')"));
  const context=vm.createContext({document,window:{confirm(){return confirmed}}});
  vm.runInContext(block,context);
  assert.equal(warning.hidden,false);
  assert.match(warning.textContent,/do not match/);
  let prevented=false;
  handlers.submit({preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  confirmed=true;
  prevented=false;
  handlers.submit({preventDefault(){prevented=true}});
  assert.equal(prevented,false);
  pnl.value='12';
  pnl.emit('input');
  assert.equal(warning.hidden,true);
  outcome.value='BREAKEVEN';
  pnl.value='1';
  outcome.emit('change');
  assert.equal(warning.hidden,false);
  outcome.value='';
  outcome.emit('change');
  assert.equal(warning.hidden,true);
});
