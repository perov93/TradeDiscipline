const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const block=source.slice(source.indexOf('const countdowns='),source.indexOf('const nySessionTimer='));

function runCountdown(until,initialNow,storage=new Map()){
  let now=initialNow,tick,reloads=0;
  const timers=until.map(value=>({
    dataset:{until:value},textContent:'',
    setAttribute(){},
    classList:{toggle(){}}
  }));
  vm.runInNewContext(block,{
    document:{querySelectorAll:()=>timers},
    Date:class extends Date{static now(){return now}},
    sessionStorage:{
      getItem:key=>storage.get(key)??null,
      setItem:(key,value)=>storage.set(key,value)
    },
    window:{location:{reload(){reloads++}}},
    setInterval(callback){tick=callback}
  });
  return {
    timers,storage,
    advance(value){now=value;tick()},
    reloads:()=>reloads
  };
}

test('checklist unlock refreshes once when the countdown reaches zero',()=>{
  const until='2026-11-12T10:00:00.000Z';
  const end=Date.parse(until);
  const countdown=runCountdown([until,until],end-1000);
  assert.match(countdown.timers[0].textContent,/01s$/);
  assert.equal(countdown.reloads(),0);
  countdown.advance(end);
  assert.equal(countdown.reloads(),1);
  countdown.advance(end+1000);
  assert.equal(countdown.reloads(),1);

  const reloaded=runCountdown([until,until],end+2000,countdown.storage);
  assert.equal(reloaded.reloads(),0);
});

test('expired countdown refreshes immediately but invalid dates do not',()=>{
  const end=Date.parse('2026-11-12T10:00:00.000Z');
  assert.equal(runCountdown(['2026-11-12T10:00:00.000Z'],end).reloads(),1);
  const invalid=runCountdown(['invalid'],end);
  invalid.advance(end+1000);
  assert.equal(invalid.reloads(),0);
});
