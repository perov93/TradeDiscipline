const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {SESSION_CHOICES,tradingSessionAt,resolveTradingSession}=require('../lib/market-sessions');

test('records every active weekday session, including overlaps',()=>{
  assert.equal(tradingSessionAt(new Date('2026-11-11T14:00:00Z')),'London / New York');
  assert.equal(tradingSessionAt(new Date('2026-11-11T09:00:00Z')),'London');
});

test('session hours follow daylight-saving time and exclude weekends',()=>{
  assert.equal(tradingSessionAt(new Date('2026-07-01T07:00:00Z')),'Tokyo / London');
  assert.equal(tradingSessionAt(new Date('2026-11-11T07:00:00Z')),'Tokyo');
  assert.equal(tradingSessionAt(new Date('2026-11-14T10:00:00Z')),'Off-session');
});

test('manual session choices override detection and invalid choices are rejected',()=>{
  assert.equal(resolveTradingSession('London',new Date('2026-11-14T10:00:00Z')),'London');
  assert.equal(resolveTradingSession('auto',new Date('2026-11-14T10:00:00Z')),'Off-session');
  assert.equal(resolveTradingSession('Unknown',new Date()),null);
  assert.ok(SESSION_CHOICES.includes('London / New York'));
});

function forexUi(initialNow){
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('const fxSessionGrid='),source.indexOf('const ruleDialog='));
  const node=()=>({
    textContent:'',style:{},attributes:{},classes:new Set(),
    setAttribute(name,value){this.attributes[name]=value},
    classList:{toggle(){}}
  });
  const summary=node();
  const cards=new Map(['sydney','tokyo','london','new-york'].map(id=>{
    const card=node();
    const children=new Map(['.fx-session-state','.fx-session-progress span','.fx-session-countdown','.fx-session-open','.fx-session-close'].map(selector=>[selector,node()]));
    card.querySelector=selector=>children.get(selector);
    card.classList.toggle=(name,active)=>active?card.classes.add(name):card.classes.delete(name);
    return [id,card];
  }));
  const grid={querySelector:selector=>cards.get(selector.match(/"([^"]+)"/)[1])};
  let now=Date.parse(initialNow),tick;
  vm.runInNewContext(block,{
    Date:class extends Date{
      constructor(...args){super(...(args.length?args:[now]))}
      static now(){return now}
    },
    Intl,document:{getElementById:id=>id==='fxSessionGrid'?grid:summary},
    setInterval(callback){tick=callback}
  });
  return {cards,summary,advance(at){now=Date.parse(at);tick()}};
}

test('closed Forex cards show the same next weekday session as their countdown, in Sofia time',()=>{
  const {cards,summary}=forexUi('2026-11-13T22:00:00Z');
  for(const [id,open,close,countdown] of [
    ['sydney','Sun 23:00','Mon 08:00','OPENS IN 1d 23h 00m 00s'],
    ['tokyo','Mon 02:00','Mon 11:00','OPENS IN 2d 02h 00m 00s'],
    ['london','Mon 10:00','Mon 19:00','OPENS IN 2d 10h 00m 00s'],
    ['new-york','Mon 15:00','Tue 00:00','OPENS IN 2d 15h 00m 00s']
  ]){
    const card=cards.get(id);
    assert.equal(card.querySelector('.fx-session-state').textContent,'CLOSED');
    assert.equal(card.querySelector('.fx-session-open').textContent,open);
    assert.equal(card.querySelector('.fx-session-close').textContent,close);
    assert.equal(card.querySelector('.fx-session-countdown').textContent,countdown);
    assert.equal(card.querySelector('.fx-session-countdown').title,`Next opening: ${open} Sofia time`);
    assert.equal(card.querySelector('.fx-session-progress span').style.width,'0%');
  }
  assert.match(summary.textContent,/NO MAJOR SESSION ACTIVE/);
});

test('Forex cards switch exactly at opening and closing and preserve server overlap detection',()=>{
  const ui=forexUi('2026-11-16T07:59:59Z');
  const london=ui.cards.get('london');
  assert.equal(london.querySelector('.fx-session-countdown').textContent,'OPENS IN 00h 00m 01s');
  ui.advance('2026-11-16T08:00:00Z');
  assert.equal(london.querySelector('.fx-session-state').textContent,'ACTIVE');
  assert.equal(london.querySelector('.fx-session-countdown').textContent,'CLOSES IN 09h 00m 00s');
  ui.advance('2026-11-16T14:00:00Z');
  assert.equal(tradingSessionAt(new Date('2026-11-16T14:00:00Z')),'London / New York');
  assert.match(ui.summary.textContent,/2 SESSIONS ACTIVE · OVERLAP/);
  ui.advance('2026-11-16T17:00:00Z');
  assert.equal(london.querySelector('.fx-session-state').textContent,'CLOSED');
  assert.equal(london.querySelector('.fx-session-open').textContent,'Tue 10:00');
  assert.equal(london.querySelector('.fx-session-countdown').textContent,'OPENS IN 15h 00m 00s');
});

test('next Forex session times use the opening date DST offsets, not the current date offsets',()=>{
  for(const [now,id,open,close] of [
    ['2026-03-06T22:00:00Z','new-york','Mon 14:00','Mon 23:00'],
    ['2026-03-27T22:00:00Z','tokyo','Mon 03:00','Mon 12:00'],
    ['2026-03-27T22:00:00Z','sydney','Mon 00:00','Mon 09:00'],
    ['2026-04-03T21:00:00Z','sydney','Mon 01:00','Mon 10:00'],
    ['2026-10-02T21:00:00Z','sydney','Mon 00:00','Mon 09:00'],
    ['2026-10-23T21:00:00Z','new-york','Mon 14:00','Mon 23:00'],
    ['2026-10-30T21:00:00Z','new-york','Mon 15:00','Tue 00:00']
  ]){
    const card=forexUi(now).cards.get(id);
    assert.equal(card.querySelector('.fx-session-open').textContent,open,`${now} ${id} opening`);
    assert.equal(card.querySelector('.fx-session-close').textContent,close,`${now} ${id} closing`);
    assert.equal(card.querySelector('.fx-session-countdown').title,`Next opening: ${open} Sofia time`);
  }
});
