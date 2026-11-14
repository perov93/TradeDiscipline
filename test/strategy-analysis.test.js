const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const block=source.slice(source.indexOf('function showStrategyTrades('),source.indexOf('function renderAnalysis('));
function element(){
  return {
    children:[],textContent:'',attributes:{},style:{},dataset:{},
    append(...children){this.children.push(...children)},
    replaceChildren(){this.children=[]},
    setAttribute(name,value){this.attributes[name]=value},
    addEventListener(name,callback){this[name]=callback}
  };
}
function setup(){
  const nodes={strategyAnalysis:element(),strategyAnalysisCaption:element(),strategyTradesTitle:element(),strategyTradesPeriod:element(),strategyTradesSummary:element(),strategyTradesRange:element(),strategyTradesList:element(),strategyTradesDialog:element()};
  const filters=['ALL','WIN','LOSS'].map(outcome=>Object.assign(element(),{dataset:{strategyOutcome:outcome}}));
  nodes.strategyTradesDialog.querySelectorAll=()=>filters;
  nodes.strategyTradesDialog.showModal=function(){this.open=true};
  nodes.strategyTradesDialog.close=function(){this.open=false};
  const selected={scrollIntoView(){this.scrolled=true}};
  const context=vm.createContext({
    document:{getElementById:id=>nodes[id],createElement:()=>element()},
    formatPnl:(value,currency)=>`${currency} ${value}`,current:new Date(2026,0,1),
    trades:[],selected,renderCalendar(){},showDay(date,items){context.shown={date,items}},
    currencyTotals:items=>items.reduce((totals,trade)=>{
      const currency=trade.currency||'USD';
      totals.set(currency,(totals.get(currency)||0)+Number(trade.pnl||0));
      return totals;
    },new Map())
  });
  vm.runInContext(source.slice(source.indexOf('function calculatePerformanceStats('),source.indexOf('function renderPerformanceStats(')),context);
  vm.runInContext(source.slice(source.indexOf('function planAdherence('),source.indexOf('function showDay(')),context);
  vm.runInContext(block,context);
  return {nodes,filters,render:context.renderStrategyAnalysis,context};
}

test('strategy win rates group names, exclude break-even and combine currencies',()=>{
  const {nodes,render}=setup();
  render([
    {strategy:' Breakout ',outcome:'WIN',currency:'USD'},
    {strategy:'breakout',outcome:'LOSS',currency:'EUR'},
    {strategy:'Breakout',outcome:'BREAKEVEN',currency:'USD'},
    {strategy:'Other',outcome:'BREAKEVEN'},
    {strategy:'',outcome:'LOSS'},
    {strategy:'No strategy',outcome:'WIN'}
  ],'Last 30 days');
  assert.equal(nodes.strategyAnalysisCaption.textContent,'Last 30 days');
  const rows=nodes.strategyAnalysis.children;
  assert.equal(rows.length,4);
  const breakout=rows.find(row=>row.children[0].textContent==='Breakout');
  assert.equal(breakout.children[1].textContent,'1 wins · 1 losses · 1 break-even');
  assert.equal(breakout.children[2].textContent,'50%');
  const other=rows.find(row=>row.children[0].textContent==='Other');
  assert.equal(other.children[2].textContent,'—');
  assert.equal(other.children[2].attributes['aria-label'],'Win rate unavailable');
  assert.deepEqual(rows.filter(row=>row.children[0].textContent==='No strategy').map(row=>row.children[2].textContent).sort(),['0%','100%']);
});

test('strategy rows open only their own records with their period and navigate to the trade day',()=>{
  const {nodes,render,context}=setup();
  const trades=[
    {id:'1',date:'2026-01-02',tradeTime:'10:00',createdAt:'2026-01-02T10:00:00Z',strategy:'Breakout',instrument:'EURUSD',side:'BUY',outcome:'WIN',currency:'EUR',pnl:25,notes:'<test>'},
    {id:'2',date:'2026-01-03',createdAt:'2026-01-03T10:00:00Z',strategy:'breakout',instrument:'XAUUSD',outcome:'LOSS',currency:'USD',pnl:-10},
    {id:'3',date:'2026-01-03',createdAt:'2026-01-03T11:00:00Z',strategy:'Other',outcome:'WIN',currency:'USD',pnl:1}
  ];
  context.trades=trades;
  render(trades,'January 2026');
  const row=nodes.strategyAnalysis.children.find(item=>item.children[0].textContent==='Breakout');
  assert.equal(row.type,'button');
  row.click();
  assert.equal(nodes.strategyTradesDialog.open,true);
  assert.equal(nodes.strategyTradesTitle.textContent,'Breakout');
  assert.equal(nodes.strategyTradesPeriod.textContent,'January 2026 · 2 trades · EUR / USD');
  const records=nodes.strategyTradesList.children.filter(node=>node.className.startsWith('strategy-trade-record'));
  assert.equal(records.length,2);
  assert.equal(records[0].children[0].children[0].textContent,'XAUUSD');
  assert.equal(records[1].children[1].textContent,'EUR 25');
  assert.equal(records[1].children[3].textContent,'10:00');
  assert.equal(records[1].children[4].textContent,'<test>');
  assert.equal(records[1].type,'button');
  records[1].click();
  assert.equal(nodes.strategyTradesDialog.open,false);
  assert.equal(context.shown.date,'2026-01-02');
  assert.equal(context.shown.items.length,1);
  assert.equal(context.selected.scrolled,true);
});

test('strategy records filter outcomes and months, preserve period summaries, and reset on reopening',()=>{
  const {nodes,filters,render,context}=setup();
  const trades=[
    {id:'1',date:'2026-01-02',tradeTime:'09:00',createdAt:'2026-01-02T12:00:00Z',strategy:'Breakout',outcome:'WIN',pnl:20,followedPlan:true},
    {id:'2',date:'2026-01-02',tradeTime:'11:00',createdAt:'2026-01-02T10:00:00Z',strategy:'breakout',outcome:'LOSS',pnl:-10,followedPlan:false},
    {id:'3',date:'2026-01-02',tradeTime:'10:00',createdAt:'2026-01-02T11:00:00Z',strategy:'Breakout',outcome:'BREAKEVEN',pnl:0,followedPlan:null},
    {id:'4',date:'2025-12-01',createdAt:'2025-12-01T10:00:00Z',strategy:' BREAKOUT ',outcome:'WIN',pnl:50},
    {id:'5',date:'2025-12-01',createdAt:'2025-12-01T11:00:00Z',strategy:'Other',outcome:'LOSS',pnl:-99}
  ];
  context.trades=trades;
  render(trades.slice(0,3),'January 2026');
  const open=()=>nodes.strategyAnalysis.children[0].click();
  const records=()=>nodes.strategyTradesList.children.filter(node=>node.className.startsWith('strategy-trade-record'));
  open();
  assert.deepEqual(records().map(node=>node.children[1].textContent),['USD -10','USD 0','USD 20']);
  const summary=nodes.strategyTradesSummary.children;
  assert.equal(summary[0].children[1].textContent,'USD 10');
  assert.equal(summary[1].children[1].textContent,'50%');
  assert.equal(summary[2].children[1].children[0].textContent,'USD 20');
  assert.equal(summary[2].children[1].children[1].textContent,'USD -10');
  assert.equal(summary[2].children[2].textContent,'Reward:risk 2.00');
  assert.equal(summary[3].children[1].textContent,'1 of 2');
  assert.equal(summary[3].children[2].textContent,'50% · 1 unknown');
  assert.equal(nodes.strategyTradesList.children[0].children[1].children[0].textContent,'USD 10');
  filters[1].onclick();
  assert.equal(records().length,1);
  assert.equal(filters[1].attributes['aria-pressed'],'true');
  assert.equal(nodes.strategyTradesSummary.children[1].children[1].textContent,'50%');
  assert.equal(nodes.strategyTradesList.children[0].children[1].children[0].textContent,'USD 20');
  nodes.strategyTradesRange.value='all';
  nodes.strategyTradesRange.onchange();
  assert.equal(records().length,2);
  assert.equal(nodes.strategyTradesSummary.children[0].children[1].textContent,'USD 60');
  nodes.strategyTradesRange.value='2025-12';
  nodes.strategyTradesRange.onchange();
  assert.equal(records().length,1);
  assert.match(nodes.strategyTradesPeriod.textContent,/December 2025 · 1 trade/);
  filters[2].onclick();
  assert.equal(records().length,0);
  assert.equal(nodes.strategyTradesList.children[0].textContent,'No trades match these filters.');
  nodes.strategyTradesDialog.close();
  open();
  assert.equal(nodes.strategyTradesRange.value,'period');
  assert.equal(filters[0].attributes['aria-pressed'],'true');
  assert.equal(records().length,3);
});

test('strategy summaries keep currencies separate and show unavailable rates and plan status',()=>{
  const {nodes,render,context}=setup();
  context.trades=[
    {id:'1',date:'2026-01-02',createdAt:'2026-01-02T10:00:00Z',strategy:'',outcome:'BREAKEVEN',currency:'EUR',pnl:0},
    {id:'2',date:'2026-01-02',createdAt:'2026-01-02T11:00:00Z',strategy:'',outcome:'BREAKEVEN',currency:'USD',pnl:2},
    {id:'3',date:'2026-01-02',createdAt:'2026-01-02T12:00:00Z',strategy:'No strategy',outcome:'WIN',currency:'USD',pnl:99}
  ];
  render(context.trades.slice(0,2),'January 2026');
  nodes.strategyAnalysis.children[0].click();
  const summary=nodes.strategyTradesSummary.children;
  assert.deepEqual(summary[0].children.slice(1,-1).map(node=>node.textContent),['EUR 0','USD 2']);
  assert.equal(summary[1].children[1].textContent,'—');
  assert.equal(summary[2].children[1].children[0].textContent,'—');
  assert.equal(summary[2].children[2].textContent,'Reward:risk —');
  assert.equal(summary[3].children[1].textContent,'—');
  assert.equal(summary[3].children[2].textContent,'No saved status · 2 unknown');
  const day=nodes.strategyTradesList.children[0];
  assert.deepEqual(day.children[1].children.map(node=>node.textContent),['EUR 0','USD 2']);
  nodes.strategyTradesRange.value='all';
  nodes.strategyTradesRange.onchange();
  assert.match(nodes.strategyTradesPeriod.textContent,/2 trades/);
});

test('strategy section displays an empty state and clears old results',()=>{
  const {nodes,render}=setup();
  render([{strategy:'Test',outcome:'WIN'}],'Selected month');
  render([],'All recorded trades');
  assert.equal(nodes.strategyAnalysis.children.length,1);
  assert.equal(nodes.strategyAnalysis.children[0].textContent,'No trades in this period.');
  assert.equal(nodes.strategyAnalysisCaption.textContent,'All recorded trades');
});
