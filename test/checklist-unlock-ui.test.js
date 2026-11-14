const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const block=source.slice(source.indexOf('function renderCountdown('),source.indexOf('const nySessionTimer='));

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

test('session countdown updates numbers without replacing the small unit labels',()=>{
  const helper=source.slice(source.indexOf('function renderCountdown('),source.indexOf('const countdowns='));
  const {renderCountdown}=vm.runInNewContext(`${helper}\n({renderCountdown})`);
  const parts=Array.from({length:4},()=>({textContent:''}));
  const timer={dataset:{countdownStyle:'units'},querySelectorAll:()=>parts};
  renderCountdown(timer,86400+9*3600+33*60+4);
  assert.deepEqual(parts.map(part=>part.textContent),['1','09','33','04']);
  renderCountdown(timer,0);
  assert.deepEqual(parts.map(part=>part.textContent),['0','00','00','00']);
});

test('expired countdown refreshes immediately but invalid dates do not',()=>{
  const end=Date.parse('2026-11-12T10:00:00.000Z');
  assert.equal(runCountdown(['2026-11-12T10:00:00.000Z'],end).reloads(),1);
  const invalid=runCountdown(['invalid'],end);
  invalid.advance(end+1000);
  assert.equal(invalid.reloads(),0);
});

test('market-closed dashboard without checklist progress elements still starts its timers',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('const checklistForm='),source.indexOf('const nySessionTimer='));
  const until='2026-11-16T23:00:00.000Z';
  const now=Date.parse('2026-11-14T12:00:00.000Z');
  const timer={
    dataset:{until,countdownLabel:'the next futures opening'},textContent:'0d 00h 00m 00s',
    setAttribute(){},classList:{toggle(){}}
  };
  const count={textContent:'0 OF 0'};
  const form={
    querySelectorAll(){return [{checked:true},{checked:false}]},
    addEventListener(){}
  };
  vm.runInNewContext(block,{
    Date:class extends Date{static now(){return now}},
    document:{
      getElementById(id){return id==='checklistForm'?form:id==='checklistCount'?count:null},
      querySelectorAll(){return [timer]}
    },
    sessionStorage:{getItem(){return null},setItem(){}},
    window:{location:{reload(){}}},
    setInterval(){}
  });
  assert.equal(count.textContent,'1 OF 2');
  assert.notEqual(timer.textContent,'0d 00h 00m 00s');
});

test('separate checklist and futures deadlines refresh once at each expiry without looping',()=>{
  const reset='2026-11-13T22:00:00.000Z';
  const opening='2026-11-15T23:00:00.000Z';
  const countdown=runCountdown([reset,opening],Date.parse(reset)-1000);
  countdown.advance(Date.parse(reset));
  assert.equal(countdown.reloads(),1);
  countdown.advance(Date.parse(reset)+1000);
  assert.equal(countdown.reloads(),1);
  countdown.advance(Date.parse(opening));
  assert.equal(countdown.reloads(),2);
  countdown.advance(Date.parse(opening)+1000);
  assert.equal(countdown.reloads(),2);
  const stale=runCountdown([reset,opening],Date.parse(opening)+2000,countdown.storage);
  assert.equal(stale.reloads(),0);
});

test('daily-lock countdown skips the futures weekend and opens Monday in Bulgaria',()=>{
  const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  const helpers=server.slice(server.indexOf('function dayKey('),server.indexOf('async function stateFor('));
  const {startOfNextDay,nextFuturesTradingTime}=vm.runInNewContext(`${helpers}\n({startOfNextDay,nextFuturesTradingTime})`,{Intl,Date});
  for(const now of ['2026-11-13T21:20:37Z','2026-11-14T10:00:00Z','2026-11-15T10:00:00Z']){
    const reset=startOfNextDay(new Date(now),'Europe/Sofia');
    const opening=nextFuturesTradingTime(reset);
    assert.equal(opening.toISOString(),'2026-11-15T23:00:00.000Z');
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
      timeZone:'Europe/Sofia',weekday:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(opening).map(part=>[part.type,part.value]));
    assert.equal(parts.weekday,'Mon');
    assert.equal(parts.day,'16');
    assert.equal(parts.hour,'01');
    assert.equal(parts.minute,'00');
  }
  const weekdayReset=startOfNextDay(new Date('2026-11-12T21:20:00Z'),'Europe/Sofia');
  assert.equal(nextFuturesTradingTime(weekdayReset).toISOString(),weekdayReset.toISOString());
  const end=Date.parse('2026-11-15T23:00:00Z');
  const countdown=runCountdown([new Date(end).toISOString()],Date.parse('2026-11-13T21:20:37Z'));
  assert.equal(countdown.timers[0].textContent,'2d 01h 39m 23s');
  countdown.advance(Date.parse('2026-11-13T22:00:00Z'));
  assert.equal(countdown.reloads(),0);
  countdown.advance(end);
  assert.equal(countdown.reloads(),1);
});

test('futures countdown respects New York close/reopen boundaries and DST',()=>{
  const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  const helpers=server.slice(server.indexOf('function dayKey('),server.indexOf('async function stateFor('));
  const nextFuturesTradingTime=vm.runInNewContext(`${helpers}\nnextFuturesTradingTime`,{Intl,Date});
  for(const [at,expected] of [
    ['2026-11-13T21:59:59Z','2026-11-13T21:59:59.000Z'],
    ['2026-11-13T22:00:00Z','2026-11-15T23:00:00.000Z'],
    ['2026-11-15T22:59:59Z','2026-11-15T23:00:00.000Z'],
    ['2026-11-15T23:00:00Z','2026-11-15T23:00:00.000Z'],
    ['2026-03-06T22:00:00Z','2026-03-08T22:00:00.000Z'],
    ['2026-10-30T21:00:00Z','2026-11-01T23:00:00.000Z'],
    ['2026-07-03T21:00:00Z','2026-07-05T22:00:00.000Z']
  ]){
    assert.equal(nextFuturesTradingTime(new Date(at)).toISOString(),expected);
  }
});

test('dashboard keeps discipline deadlines separate and reports closed futures markets',async()=>{
  const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  const helpers=server.slice(server.indexOf('function dayKey('),server.indexOf('async function stateFor('));
  const dashboardSource=server.slice(server.indexOf('async function dashboard('),server.indexOf('const authLimiter ='));
  const query=items=>({sort(){return {async lean(){return items}}}});
  for(const [at,locked,cooldownUntil,expectedReset,expectedDisplay,expectedMarketClosed,expectedOpeningCountdown] of [
    ['2026-11-13T21:24:00Z',true,null,'2026-11-13T22:00:00.000Z','2026-11-15T23:00:00.000Z',false,true],
    ['2026-11-12T21:24:00Z',true,null,'2026-11-12T22:00:00.000Z','2026-11-12T22:00:00.000Z',false,false],
    ['2026-11-13T21:24:00Z',false,'2026-11-13T21:39:00Z','2026-11-13T21:39:00.000Z','2026-11-13T21:39:00.000Z',false,false],
    ['2026-11-14T10:00:00Z',false,null,null,'2026-11-15T23:00:00.000Z',true,true]
  ]){
    const now=Date.parse(at);
    let rendered;
    const dashboard=vm.runInNewContext(`${helpers}\n${dashboardSource}\ndashboard`,{
      Date:class extends Date{constructor(...args){super(...(args.length?args:[now]))}},
      Intl,User:{async findById(){return {_id:'user',timezone:'Europe/Sofia',limits:{maxTrades:3,maxLosses:2}}}},
      Rule:{find:()=>query([])},Trade:{find:()=>query([]),async aggregate(){return []}},
      NoSetup:{find:()=>query([])},
      async stateFor(){return {stopped:locked,checks:[],cooldownUntil:cooldownUntil?new Date(cooldownUntil):null}},
      isChecklistComplete:()=>false
    });
    await dashboard({session:{user:{id:'user'}}},{render(name,data){rendered=data}});
    assert.equal(rendered.checklistAvailableAt?.toISOString()||null,expectedReset);
    assert.equal(rendered.availableAt.toISOString(),expectedDisplay);
    assert.equal(rendered.marketClosed,expectedMarketClosed);
    assert.equal(rendered.futuresOpeningCountdown,expectedOpeningCountdown);
    if(expectedReset && expectedReset!==expectedDisplay){
      assert.match(rendered.checklistAvailableAtLabel,/14 Nov 2026.*00:00/);
      assert.match(rendered.availableAtLabel,/16 Nov 2026.*01:00/);
    }
  }
});
