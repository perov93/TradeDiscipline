const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ejs=require('ejs');
const {recordReturnTo}=require('../lib/navigation');

test('record navigation returns to a safe calendar URL and restores only a valid day',()=>{
  assert.equal(recordReturnTo({returnTo:'calendar',returnDate:'2024-02-29'}),'/?calendarDate=2024-02-29#calendar');
  assert.equal(recordReturnTo({returnTo:'calendar',returnDate:'2026-02-30'}),'/#calendar');
  assert.equal(recordReturnTo({returnTo:'calendar',returnDate:'https://example.com'}),'/#calendar');
  assert.equal(recordReturnTo({returnTo:'https://example.com',returnDate:'2024-02-29'}),'/#journal');
  assert.equal(recordReturnTo({}),'/#journal');
});

function recentTradesHtml(trades){
  const template=fs.readFileSync(path.join(__dirname,'..','views','dashboard.ejs'),'utf8');
  const preamble=template.slice(0,template.indexOf('<html lang='));
  const start=template.indexOf('<section class="panel recent-trades"');
  const recent=template.slice(start,template.indexOf('<div class="no-setup-records">',start))+'</section>';
  return ejs.render(preamble+recent,{
    user:{timezone:'Europe/Sofia'},trades,todays:[],limits:{maxTrades:3,maxLosses:2},
    losses:0,rules:[],active:[],checks:[],
    dayKey:(date,timezone)=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date),
    timeKey:(date,timezone)=>new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)
  });
}

test('recent journal trades display exactly the latest five with net/day totals and calendar links',()=>{
  const trade=(createdAt,pnl,extra={})=>({
    _id:createdAt,createdAt:new Date(createdAt),instrument:'MNQ1!',side:'BUY',
    outcome:pnl>0?'WIN':'LOSS',currency:'USD',strategy:'PHP',pnl,...extra
  });
  const html=recentTradesHtml([
    trade('2026-11-11T09:00:00Z',500,{instrument:'Excluded'}),
    trade('2026-11-12T17:55:00Z',-1052),
    trade('2026-11-13T10:18:00Z',-1477),
    trade('2026-11-11T10:51:00Z',973,{side:''}),
    trade('2026-11-12T18:03:00Z',-1454,{side:'SELL'}),
    trade('2026-11-13T10:22:00Z',-1054,{followedPlan:false})
  ]);
  const rows=[...html.matchAll(/<a class="recent-trade-row"[\s\S]*?<\/a>/g)].map(match=>match[0]);
  assert.equal(rows.length,5);
  assert.equal((html.match(/class="recent-trade-group"/g)||[]).length,3);
  assert.match(html,/LAST 5/);
  assert.match(html,/−4,064\.00 USD/);
  assert.match(html,/FRI 13 NOV/);
  assert.match(html,/−2,531\.00 USD/);
  assert.match(html,/−2,506\.00 USD/);
  assert.match(html,/\+973\.00 USD/);
  assert.doesNotMatch(html,/Excluded/);
  assert.match(rows[0],/>12:22<\/span>/);
  assert.match(rows[0],/>Plan broken<\/span>/);
  assert.match(rows[1],/>PHP<\/span>/);
  assert.match(rows[2],/>20:03<\/span>/);
  assert.match(rows[2],/recent-trade-side pnl-neg">SELL/);
  assert.match(rows[4],/>12:51<\/span>/);
  assert.doesNotMatch(rows[4],/recent-trade-side/);
  assert.match(rows[0],/href="\/\?calendarDate=2026-11-13#calendar"/);
  assert.match(rows[4],/href="\/\?calendarDate=2026-11-11#calendar"/);
  assert.match(html,/href="#calendar">OPEN CALENDAR TO EDIT/);
});

test('recent journal totals stay separate by currency, use account dates and safely render saved values',()=>{
  const html=recentTradesHtml([
    {_id:'1',createdAt:new Date('2026-11-13T22:30:00Z'),tradeTime:'00:05',instrument:'<img src=x>',pnl:25,currency:'EUR',followedPlan:null},
    {_id:'2',createdAt:new Date('2026-11-13T21:30:00Z'),instrument:'MNQ1!',pnl:-10,currency:'USD',outcome:'WIN',strategy:'<script>test</script>'}
  ]);
  assert.match(html,/SAT 14 NOV/);
  assert.match(html,/FRI 13 NOV/);
  assert.match(html,/\+25\.00 EUR/);
  assert.match(html,/−10\.00 USD/);
  assert.doesNotMatch(html,/\+15\.00/);
  assert.match(html,/recent-trade-time">00:05/);
  assert.match(html,/recent-trade-time">23:30/);
  assert.match(html,/&lt;img src=x&gt;/);
  assert.match(html,/&lt;script&gt;test&lt;\/script&gt;/);
  assert.doesNotMatch(html,/Plan broken/);
  assert.match(html,/href="\/\?calendarDate=2026-11-14#calendar"/);
  const empty=recentTradesHtml([]);
  assert.match(empty,/No trades recorded yet/);
  assert.doesNotMatch(empty,/class="recent-trades-net"/);
  assert.doesNotMatch(empty,/class="recent-trade-row"/);
});

function closedMarketHtml(today,trades,marketClosed=true){
  const template=fs.readFileSync(path.join(__dirname,'..','views','dashboard.ejs'),'utf8');
  const preamble=template.slice(0,template.indexOf('<html lang='));
  const start=template.indexOf('<% if (closedMarketRecap) { %>');
  const card=template.slice(start,template.indexOf('</section>',start));
  return ejs.render(preamble+card,{
    user:{timezone:'Europe/Sofia'},today,trades,marketClosed,
    todays:[],limits:{maxTrades:3,maxLosses:2},losses:0,rules:[],active:[],checks:[],
    dayKey:(date,timezone)=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date),
    timeKey:(date,timezone)=>new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)
  });
}

test('closed-market recap uses the latest week, separates currencies and excludes unknown plan status',()=>{
  const trade=(createdAt,pnl,outcome,followedPlan,currency='USD',instrument='MNQ')=>({
    createdAt:new Date(createdAt),pnl,outcome,followedPlan,currency,instrument,side:'BUY'
  });
  const trades=[
    trade('2026-11-08T21:59:00Z',900,'WIN',true),
    trade('2026-11-08T22:30:00Z',100,'WIN',true),
    trade('2026-11-11T10:00:00Z',-40,'LOSS',false),
    trade('2026-11-12T10:00:00Z',0,'BREAKEVEN',null),
    trade('2026-11-13T10:00:00Z',30,'WIN',null,'EUR','<img src=x>')
  ];
  for(const today of ['2026-11-14','2026-11-15','2026-11-16','2026-11-20']){
    const html=closedMarketHtml(today,trades);
    assert.match(html,/2026-11-09 – 2026-11-15/);
    assert.match(html,/\+60\.00 USD/);
    assert.match(html,/\+30\.00 EUR/);
    assert.doesNotMatch(html,/960\.00|\+90\.00/);
    assert.match(html,/<strong>4<\/strong>\s*<small>W \/ L \/ BE · 2 \/ 1 \/ 1<\/small>/);
    assert.match(html,/<strong>67%<\/strong>/);
    assert.match(html,/<strong>50%<\/strong>/);
    assert.match(html,/of 2 known/);
    assert.match(html,/LAST RECORDED TRADE/);
    assert.match(html,/href="\/\?calendarDate=2026-11-13#calendar"/);
    assert.match(html,/&lt;img src=x&gt;/);
    assert.doesNotMatch(html,/TRADES LEFT TODAY|LOSSES LEFT BEFORE LOCK|account-today/);
  }
  const open=closedMarketHtml('2026-11-16',trades,false);
  assert.match(open,/TRADES LEFT TODAY/);
  assert.match(open,/LOSSES LEFT BEFORE LOCK/);
  assert.doesNotMatch(open,/WEEKLY RECAP|LAST RECORDED TRADE/);
});

test('closed-market recap handles empty and break-even weeks across year boundaries',()=>{
  const empty=closedMarketHtml('2027-01-02',[]);
  assert.match(empty,/2026-12-28 – 2027-01-03/);
  assert.match(empty,/No trades recorded for this week/);
  assert.match(empty,/No trades recorded yet/);
  assert.doesNotMatch(empty,/NaN|Infinity|<strong>0%/);
  const flat=closedMarketHtml('2027-01-04',[{
    createdAt:new Date('2026-12-31T10:00:00Z'),instrument:'TEST',pnl:0,currency:'USD',
    outcome:'BREAKEVEN',followedPlan:null
  }]);
  assert.match(flat,/2026-12-28 – 2027-01-03/);
  assert.match(flat,/<strong>1<\/strong>\s*<small>W \/ L \/ BE · 0 \/ 0 \/ 1<\/small>/);
  assert.match(flat,/0\.00 USD/);
  assert.doesNotMatch(flat,/<strong>0%/);
});
