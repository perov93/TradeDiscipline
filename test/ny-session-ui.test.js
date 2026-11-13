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
    {type:'close',at:'2026-11-12T21:00:00Z'}
  ];
  const elements=new Map();
  for(const id of ['nySessionTimer','nySessionPhase','nySessionMilestone',
    'nySessionPanel','nySessionBadge','nyLiveBanner','nyLiveLabel','nyLiveCountdown','nySessionNow',
    'nyTimePremarket','nyTimeOpen','nyTimeClose','nyDatePremarket','nyDateOpen','nyDateClose']){
    const classes=new Set();
    elements.set(id,{
      textContent:'',hidden:false,dataset:{},style:{},
      classList:{
        toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name)},
        remove(...names){names.forEach(name=>classes.delete(name))},
        contains:name=>classes.has(name)
      },
      replaceChildren(){},append(){}
    });

  }
  elements.get('nySessionTimer').dataset.schedule=encodeURIComponent(JSON.stringify(schedule));
  elements.get('nySessionTimer').dataset.accountTimezone='Europe/Sofia';
  let now=Date.parse('2026-11-11T13:29:59Z');
  let tick;
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf("const nySessionTimer="),source.indexOf("const fxSessionGrid="));
  vm.runInNewContext(block,{
    Date:class extends Date{static now(){return now}},
    Intl,
    document:{getElementById:id=>elements.get(id)},
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
  now=Date.parse('2026-12-01T00:00:00Z');
  tick();
  assert.equal(banner.hidden,true);
  assert.equal(elements.get('nySessionBadge').textContent,'SCHEDULE UNAVAILABLE');
  assert.equal(elements.get('nySessionNow').hidden,true);
  assert.equal(elements.get('nyTimePremarket').textContent,'—');
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
