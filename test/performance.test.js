const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const code=source.slice(source.indexOf('function calculatePerformanceStats('),source.indexOf('function renderAnalysis('));
const context=vm.createContext({});
vm.runInContext(code,context);
const calculate=context.calculatePerformanceStats;
const trade=(id,date,pnl,outcome='WIN',currency='USD')=>({
  id,date,createdAt:`${date}T12:00:00Z`,pnl,outcome,currency,instrument:'TEST'
});
test('performance stats calculate exact averages, monthly results, profit factor and drawdown',()=>{
  const items=[
    trade('1','2026-01-02',100),
    trade('2','2026-01-03',-40,'LOSS'),
    trade('3','2026-01-03',-80,'LOSS'),
    trade('4','2026-02-02',50),
    trade('5','2026-02-03',0,'BREAKEVEN')
  ];
  const stats=calculate(items.slice().reverse());
  assert.equal(stats.net,30);
  assert.equal(stats.averageMonth,15);
  assert.equal(stats.averageTrade,6);
  assert.equal(stats.averageWin,75);
  assert.equal(stats.averageLoss,-60);
  assert.equal(stats.maxDrawdown,120);
  assert.equal(stats.profitFactor,1.25);
  assert.equal(stats.winRate,50);
  assert.equal(stats.profitableDays,2);
  assert.equal(stats.recordedDays,4);
  assert.equal(stats.profitableMonths,1);
  assert.equal(stats.recordedMonths,2);
  assert.equal(stats.bestMonth.date,'2026-02');
  assert.equal(stats.bestMonth.pnl,50);
  assert.equal(stats.worstMonth.pnl,-20);
  assert.equal(stats.bestTrade.id,'1');
  assert.equal(stats.worstTrade.id,'3');
  assert.equal(items[0].id,'1');
});
test('empty data and break-even records do not produce invented ratios',()=>{
  const empty=calculate([]);
  for(const key of ['averageMonth','averageTrade','averageWin','averageLoss','winRate','maxDrawdown','profitFactor','bestTrade','worstTrade','bestMonth','worstMonth']){
    assert.equal(empty[key],null,key);
  }
  const flat=calculate([trade('1','2026-01-02',0,'BREAKEVEN')]);
  assert.equal(flat.profitFactor,null);
  assert.equal(flat.winRate,null);
  assert.equal(flat.maxDrawdown,0);
  assert.equal(flat.averageTrade,0);
});
test('only wins, only losses, and inconsistent outcomes use the documented formulas',()=>{
  const wins=calculate([trade('1','2026-01-02',10),trade('2','2026-01-03',20)]);
  assert.equal(wins.profitFactor,Infinity);
  assert.equal(wins.averageLoss,null);
  assert.equal(wins.maxDrawdown,0);
  const losses=calculate([trade('1','2026-01-02',-10,'LOSS'),trade('2','2026-01-03',-20,'LOSS')]);
  assert.equal(losses.profitFactor,0);
  assert.equal(losses.maxDrawdown,30);
  assert.equal(losses.averageWin,null);
  const inconsistent=calculate([trade('1','2026-01-02',-10,'WIN')]);
  assert.equal(inconsistent.winRate,100);
  assert.equal(inconsistent.averageLoss,-10);
  assert.equal(inconsistent.averageWin,null);
});
test('same-day chronology and zero-recorded-month gaps are respected',()=>{
  const first=trade('1','2026-01-02',10);
  const second={...trade('2','2026-01-02',-5,'LOSS'),createdAt:'2026-01-02T13:00:00Z'};
  const third=trade('3','2026-03-02',-5,'LOSS');
  const stats=calculate([third,second,first]);
  assert.equal(stats.maxDrawdown,10);
  assert.equal(stats.averageMonth,0);
  assert.equal(stats.recordedMonths,2);
  assert.equal(stats.recordedDays,2);
  assert.equal(stats.profitableDays,1);
});
test('rendered cards filter currencies and expose every requested statistic with unavailable labels',()=>{
  function element(){
    return{children:[],textContent:'',classList:{add(){}},append(...children){this.children.push(...children)},replaceChildren(){this.children=[]}};
  }
  const nodes={performanceStats:element(),performanceStatsCaption:element()};
  const renderer=vm.createContext({
    document:{getElementById:id=>nodes[id],createElement:()=>element()},
    analysisPeriodLabel:{textContent:'All recorded trades'},
    formatPnl:(value,currency)=>`${currency} ${Number(value).toFixed(2)}`
  });
  vm.runInContext(code,renderer);
  renderer.renderPerformanceStats([
    trade('1','2026-01-02',10),trade('2','2026-01-02',900,'WIN','EUR')
  ],'USD');
  const cards=nodes.performanceStats.children.flatMap(group=>group.children[1].children);
  assert.equal(cards.length,18);
  const value=label=>cards.find(card=>card.children[0].textContent===label).children[1].textContent;
  assert.equal(value('NET PROFIT'),'USD 10.00');
  assert.equal(value('TRADES'),'1');
  assert.equal(value('PROFIT FACTOR'),'∞');
  for(const name of ['CURRENT BALANCE','DEPOSITS','WITHDRAWALS','AVERAGE TRADE DURATION']){
    const card=cards.find(card=>card.children[0].textContent===name);
    assert.equal(card.children[1].textContent,'—');
    assert.match(card.children[2].textContent,/Unavailable:/);
  }
  assert.match(nodes.performanceStatsCaption.textContent,/USD/);
});
test('account selection scopes analysis metrics, charts and strategy records without splitting P&L',()=>{
  function element(){
    return {
      children:[],textContent:'',value:'',style:{},attributes:{},dataset:{},classList:{add(){},toggle(){}},
      append(...children){this.children.push(...children)},
      replaceChildren(){this.children=[]},setAttribute(name,value){this.attributes[name]=value}
    };
  }
  const nodes=Object.fromEntries([
    'performanceStats','performanceStatsCaption','currentWinStreak','currentLossStreak',
    'bestWinStreak','worstLossStreak'
  ].map(id=>[id,element()]));
  const items=[
    {...trade('1','2026-01-02',150),account:' Apex ',accountCount:5,followedPlan:true},
    {...trade('2','2026-01-03',-30,'LOSS'),account:'Apex',accountCount:15,followedPlan:false},
    {...trade('3','2026-01-04',900),account:'Personal'},
    {...trade('4','2026-01-05',20),account:'Unassigned'},
    {...trade('5','2026-01-06',-5,'LOSS'),account:'   '},
    trade('6','2026-01-07',10),
    {...trade('7','2025-12-01',50),account:'Apex'},
    {...trade('8','2026-01-08',80,'WIN','EUR'),account:'Apex'}
  ];
  const renderer=vm.createContext({
    document:{getElementById:id=>nodes[id],createElement:()=>element()},
    trades:items,noSetupEntries:[{date:'2026-01-01'}],
    allAnalysisAccountKeys:new Set(['account:Apex','account:Personal','account:Unassigned','unassigned']),
    analysisAccountLabels:new Map([['account:Apex','Apex'],['account:Personal','Personal'],['account:Unassigned','Unassigned'],['unassigned','Unassigned']]),
    selectedAnalysisAccounts:new Set(['account:Apex']),analysisCurrency:element(),
    analysisNoSetupCount:element(),analysisTradeCount:element(),analysisWinRate:element(),
    analysisPlanRate:element(),analysisNetPnl:element(),analysisPeriodLabel:element(),
    outcomeBreakdown:element(),dailyBars:element(),dailyAnalysisCaption:element(),
    analysisRange:'month',selectedAnalysisCurrency:'USD',analysisRangeButtons:[],
    current:new Date(2026,0,1),title:{textContent:'January 2026'},
    formatPnl:(value,currency)=>`${currency} ${Number(value).toFixed(2)}`,
    currencyTotals:records=>records.reduce((totals,record)=>
      totals.set(record.currency,(totals.get(record.currency)||0)+record.pnl),new Map()),
    renderEquityChart(records,currency){renderer.chart={records,currency}},
    renderStrategyAnalysis(records,label,allRecords){renderer.strategy={records,label,allRecords}}
  });
  vm.runInContext(source.slice(source.indexOf('function getAccountRecords('),source.indexOf('function appendSvg(')),renderer);
  vm.runInContext(source.slice(source.indexOf('function calculatePerformanceStats('),source.indexOf('function showStrategyTrades(')),renderer);
  vm.runInContext(source.slice(source.indexOf('function renderAnalysis('),source.indexOf('function showDay(')),renderer);
  const value=label=>nodes.performanceStats.children.flatMap(group=>group.children[1].children)
    .find(card=>card.children[0].textContent===label).children[1].textContent;
  const ids=records=>Array.from(records,record=>record.id);
  renderer.renderAnalysis();
  assert.equal(value('NET PROFIT'),'USD 120.00');
  assert.equal(value('TRADES'),'2');
  assert.equal(renderer.analysisTradeCount.textContent,'3');
  assert.equal(renderer.analysisWinRate.textContent,'67%');
  assert.equal(renderer.analysisPlanRate.textContent,'50%');
  assert.equal(nodes.currentLossStreak.textContent,'0');
  assert.equal(nodes.worstLossStreak.textContent,'1');
  assert.deepEqual(ids(renderer.chart.records),['1','2','8']);
  assert.equal(renderer.chart.currency,'USD');
  assert.deepEqual(ids(renderer.strategy.allRecords),['1','2','7','8']);
  assert.match(renderer.strategy.label,/January 2026 · Apex/);
  assert.equal(renderer.dailyBars.children.length,3);
  assert.equal(renderer.analysisNoSetupCount.textContent,'1');

  renderer.selectedAnalysisAccounts=new Set(['account:Apex','account:Personal']);
  renderer.renderAnalysis();
  assert.deepEqual(ids(renderer.chart.records),['1','2','3','8']);
  assert.equal(renderer.analysisTradeCount.textContent,'4');
  assert.match(renderer.strategy.label,/January 2026 · 2 accounts/);

  renderer.analysisRange='all';
  renderer.selectedAnalysisAccounts=new Set(['account:Apex']);
  renderer.renderAnalysis();
  assert.equal(value('NET PROFIT'),'USD 170.00');
  renderer.selectedAnalysisAccounts=new Set(['unassigned']);
  renderer.renderAnalysis();
  assert.deepEqual(ids(renderer.chart.records),['5','6']);
  assert.equal(value('NET PROFIT'),'USD 5.00');
  renderer.selectedAnalysisAccounts=new Set(['account:Unassigned']);
  renderer.renderAnalysis();
  assert.deepEqual(ids(renderer.chart.records),['4']);
  renderer.selectedAnalysisAccounts=new Set(['account:Personal']);
  renderer.analysisRange='day';
  renderer.selectedCalendarDate='2026-01-02';
  renderer.renderAnalysis();
  assert.equal(value('TRADES'),'0');
  assert.equal(value('NET PROFIT'),'—');
  assert.equal(renderer.analysisCurrency.attributes['aria-disabled'],'true');
  renderer.selectedAnalysisAccounts=new Set(renderer.allAnalysisAccountKeys);
  renderer.analysisRange='all';
  renderer.selectedAnalysisCurrency='USD';
  renderer.renderAnalysis();
  assert.equal(renderer.analysisTradeCount.textContent,'8');
  assert.equal(value('NET PROFIT'),'USD 1095.00');
  assert.equal(renderer.analysisNoSetupCount.textContent,'1');
});
