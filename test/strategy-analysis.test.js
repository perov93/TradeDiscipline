const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const block=source.slice(source.indexOf('function showStrategyTrades('),source.indexOf('function renderAnalysis('));
function element(){
  return {
    children:[],textContent:'',attributes:{},
    append(...children){this.children.push(...children)},
    replaceChildren(){this.children=[]},
    setAttribute(name,value){this.attributes[name]=value},
    addEventListener(name,callback){this[name]=callback}
  };
}
function setup(){
  const nodes={strategyAnalysis:element(),strategyAnalysisCaption:element(),strategyTradesTitle:element(),strategyTradesPeriod:element(),strategyTradesList:element(),strategyTradesDialog:element()};
  nodes.strategyTradesDialog.showModal=function(){this.open=true};
  nodes.strategyTradesDialog.close=function(){this.open=false};
  const selected={scrollIntoView(){this.scrolled=true}};
  const context=vm.createContext({
    document:{getElementById:id=>nodes[id],createElement:()=>element()},
    formatPnl:(value,currency)=>`${currency} ${value}`,current:new Date(2026,0,1),
    trades:[],selected,renderCalendar(){},showDay(date,items){context.shown={date,items}}
  });
  vm.runInContext(block,context);
  return {nodes,render:context.renderStrategyAnalysis,context};
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
    {id:'1',date:'2026-01-02',createdAt:'2026-01-02T10:00:00Z',strategy:'Breakout',instrument:'EURUSD',side:'BUY',outcome:'WIN',currency:'EUR',pnl:25,notes:'<test>'},
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
  assert.equal(nodes.strategyTradesPeriod.textContent,'January 2026 · 2 trades · all currencies');
  const records=nodes.strategyTradesList.children;
  assert.equal(records.length,2);
  assert.equal(records[0].children[0].children[0].textContent,'XAUUSD');
  assert.equal(records[1].children[0].children[1].textContent,'EUR 25');
  assert.equal(records[1].children[2].textContent,'<test>');
  records[1].children.at(-1).click();
  assert.equal(nodes.strategyTradesDialog.open,false);
  assert.equal(context.shown.date,'2026-01-02');
  assert.equal(context.shown.items.length,1);
  assert.equal(context.selected.scrolled,true);
});

test('strategy section displays an empty state and clears old results',()=>{
  const {nodes,render}=setup();
  render([{strategy:'Test',outcome:'WIN'}],'Selected month');
  render([],'All recorded trades');
  assert.equal(nodes.strategyAnalysis.children.length,1);
  assert.equal(nodes.strategyAnalysis.children[0].textContent,'No trades in this period.');
  assert.equal(nodes.strategyAnalysisCaption.textContent,'All recorded trades');
});
