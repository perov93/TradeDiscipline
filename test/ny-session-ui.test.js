const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('NY reminder transitions from waiting through pre-market, regular trading and closing',()=>{
  const schedule=[
    {type:'premarket',at:'2026-11-11T13:30:00Z'},
    {type:'open',at:'2026-11-11T14:30:00Z'},
    {type:'close',at:'2026-11-11T21:00:00Z'},
    {type:'premarket',at:'2026-11-12T13:30:00Z'},
    {type:'open',at:'2026-11-12T14:30:00Z'},
    {type:'close',at:'2026-11-12T21:00:00Z'},
    {type:'premarket',at:'2026-11-13T13:30:00Z'},
    {type:'open',at:'2026-11-13T14:30:00Z'},
    {type:'close',at:'2026-11-13T21:00:00Z'},
    {type:'premarket',at:'2026-11-16T13:30:00Z'},
    {type:'open',at:'2026-11-16T14:30:00Z'},
    {type:'close',at:'2026-11-16T21:00:00Z'}
  ];
  const elements=new Map();
  for(const id of ['nySessionTimer','nySessionPhase','nySessionMilestone',
    'nySessionPanel','nySessionBadge','nyLiveBanner','nyLiveLabel','nyLiveCountdown','nySessionNow',
    'nyTimePremarket','nyTimeOpen','nyTimeClose','nyDatePremarket','nyDateOpen','nyDateClose','nySessionWhen']){
    const classes=new Set();
    elements.set(id,{
      textContent:'',hidden:false,dataset:{},style:{},
      setAttribute(){},
      classList:{
        toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name)},
        remove(...names){names.forEach(name=>classes.delete(name))},
        contains:name=>classes.has(name)
      },
      replaceChildren(...children){this.children=children},append(){}
    });

  }
  elements.get('nySessionTimer').dataset.schedule=encodeURIComponent(JSON.stringify(schedule));
  elements.get('nySessionTimer').dataset.accountTimezone='Europe/Sofia';
  let now=Date.parse('2026-11-11T13:29:59Z');
  let tick;
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const countdownHelper=source.slice(source.indexOf('function renderCountdown('),source.indexOf('const countdowns='));
  const block=countdownHelper+source.slice(source.indexOf("const nySessionTimer="),source.indexOf("const fxSessionGrid="));
  vm.runInNewContext(block,{
    Date:class extends Date{static now(){return now}},
    Intl,
    document:{getElementById:id=>elements.get(id),createElement:()=>({textContent:''})},
    setInterval(callback){tick=callback}
  });
  const banner=elements.get('nyLiveBanner');
  const label=elements.get('nyLiveLabel');
  assert.equal(banner.hidden,true);
  assert.equal(elements.get('nySessionNow').hidden,true);
  assert.match(elements.get('nySessionMilestone').textContent,/NEXT PRE-MARKET/);
  assert.equal(elements.get('nyTimePremarket').textContent,'15:30');
  assert.equal(elements.get('nyTimeOpen').textContent,'16:30');
  assert.equal(elements.get('nyTimeClose').textContent,'23:00');
  assert.equal(elements.get('nySessionWhen').children[0].textContent,'Wed 15:30');
  assert.equal(elements.get('nySessionWhen').children[1],' your time · 08:30 ET');
  assert.match(elements.get('nyDatePremarket').textContent,/11 Nov/);
  for(const [at,text,liveClass,milestone,countdown] of [
    ['2026-11-11T13:30:00Z','PRE-MARKET OPEN','is-premarket','NY OPENS','0d 01h 00m 00s'],
    ['2026-11-11T14:30:00Z','NY SESSION OPEN','is-regular','NY CLOSES','0d 06h 30m 00s']
  ]){
    now=Date.parse(at);
    tick();
    assert.equal(banner.hidden,false);
    assert.equal(label.textContent,text);
    assert.match(elements.get('nySessionMilestone').textContent,new RegExp(milestone));
    assert.equal(elements.get('nySessionTimer').textContent,countdown);
    assert.equal(elements.get('nyTimePremarket').textContent,'15:30');
    assert.equal(elements.get('nySessionPanel').classList.contains(liveClass),true);
    assert.equal(elements.get('nySessionNow').hidden,false);
    const expected=liveClass==='is-premarket'?0:60/450*100;
    assert.ok(Math.abs(parseFloat(elements.get('nySessionNow').style.left)-expected)<0.001);
  }
  now=Date.parse('2026-11-11T20:59:59Z');
  tick();
  assert.ok(parseFloat(elements.get('nySessionNow').style.left)>99.99);
  now=Date.parse('2026-11-11T21:00:00Z');
  tick();
  assert.equal(banner.hidden,true);
  assert.equal(elements.get('nySessionNow').hidden,true);
  assert.match(elements.get('nySessionMilestone').textContent,/NEXT PRE-MARKET/);
  assert.match(elements.get('nyTimePremarket').title,/12 Nov 2026/);
  assert.match(elements.get('nyDatePremarket').textContent,/12 Nov/);
  assert.equal(elements.get('nySessionPanel').classList.contains('is-regular'),false);
  for(const [at,countdown] of [
    ['2026-11-13T21:23:06Z','2d 16h 06m 54s'],
    ['2026-11-14T12:00:00Z','2d 01h 30m 00s'],
    ['2026-11-15T23:00:00Z','0d 14h 30m 00s']
  ]){
    now=Date.parse(at);
    tick();
    assert.equal(banner.hidden,true);
    assert.equal(elements.get('nySessionTimer').textContent,countdown);
    assert.equal(elements.get('nyTimePremarket').textContent,'15:30');
    assert.equal(elements.get('nyTimeOpen').textContent,'16:30');
    assert.equal(elements.get('nyTimeClose').textContent,'23:00');
    assert.match(elements.get('nyDatePremarket').textContent,/Mon.*16 Nov/);
    assert.equal(elements.get('nySessionBadge').textContent,'NEXT: MON 16 NOV');
  }
  const parts=Array.from({length:4},()=>({textContent:''}));
  elements.get('nySessionTimer').dataset.countdownStyle='units';
  elements.get('nySessionTimer').querySelectorAll=()=>parts;
  now=Date.parse('2026-11-14T12:00:00Z');
  tick();
  assert.deepEqual(parts.map(part=>part.textContent),['2','01','30','00']);
  now=Date.parse('2026-12-01T00:00:00Z');
  tick();
  assert.equal(banner.hidden,true);
  assert.equal(elements.get('nySessionBadge').textContent,'SCHEDULE UNAVAILABLE');
  assert.equal(elements.get('nySessionNow').hidden,true);
  assert.equal(elements.get('nyTimePremarket').textContent,'—');
  assert.equal(elements.get('nySessionWhen').textContent,'');
});

test('server schedule keeps the current session events and follows New York daylight saving time',()=>{
  const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  const functions=server.slice(server.indexOf('function dayKey('),server.indexOf('async function stateFor('));
  const schedule=vm.runInNewContext(`${functions}\nnySessionSchedule`,{Intl,Date});
  const regular=schedule(new Date('2026-11-11T16:00:00Z')).schedule;
  assert.deepEqual(Array.from(regular.slice(0,3),event=>event.type),['premarket','open','close']);
  assert.equal(regular[0].at,'2026-11-11T13:30:00.000Z');
  const afterDst=schedule(new Date('2026-03-08T12:00:00Z')).schedule;
  const next=afterDst.find(event=>event.type==='premarket'&&Date.parse(event.at)>Date.parse('2026-03-08T12:00:00Z'));
  assert.equal(next.at,'2026-03-09T12:30:00.000Z');
});
