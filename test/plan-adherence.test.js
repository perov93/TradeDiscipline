const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('plan adherence excludes unknown historical records from its denominator',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('function planAdherence('),source.indexOf('function showDay('));
  const context=vm.createContext({});
  vm.runInContext(block,context);
  const result=context.planAdherence([
    {followedPlan:true},
    {followedPlan:false},
    {followedPlan:null},
    {}
  ]);
  assert.equal(result.followed,1);
  assert.equal(result.known,2);
  assert.equal(result.unknown,2);
  const unknownOnly=context.planAdherence([{followedPlan:null},{}]);
  assert.equal(unknownOnly.known,0);
  assert.equal(unknownOnly.unknown,2);
});
