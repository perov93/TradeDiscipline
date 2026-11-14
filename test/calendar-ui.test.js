const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','public','calendar-ui.js'),'utf8');

function element(text=''){
  const classes=new Set();
  return{
    children:[],dataset:{},style:{},attributes:{},handlers:{},textContent:text,
    get cells(){return this.children},
    get rows(){return this.children},
    classList:{
      add(name){classes.add(name)},
      contains(name){return classes.has(name)},
      toggle(name,on){if(on)classes.add(name);else classes.delete(name)}
    },
    append(child){child.parent=this;this.children.push(child)},
    after(child){child.parent=this.parent;this.parent.children.splice(this.parent.children.indexOf(this)+1,0,child)},
    setAttribute(name,value){this.attributes[name]=value},
    addEventListener(name,handler){this.handlers[name]=handler},
    focus(){this.focused=true}
  };
}

test('overview tabs support arrow navigation, wrapping, Home and End with one tab stop',()=>{
  const tabs=['summary','stats','charts'].map(name=>Object.assign(element(),{dataset:{analysisPane:name}}));
  const panes=['summary','stats','charts'].map(name=>Object.assign(element(),{dataset:{pane:name}}));
  vm.runInNewContext(source,{
    document:{
      querySelectorAll:selector=>selector==='.analysis-tab'?tabs:panes,
      getElementById:()=>null
    }
  });
  let prevented=0;
  const press=(index,key)=>tabs[index].handlers.keydown({key,preventDefault(){prevented++}});
  press(0,'ArrowLeft');
  assert.equal(tabs[2].focused,true);
  assert.deepEqual(tabs.map(tab=>tab.tabIndex),[-1,-1,0]);
  assert.deepEqual(panes.map(pane=>pane.hidden),[true,true,false]);
  press(2,'ArrowRight');
  assert.equal(tabs[0].attributes['aria-selected'],'true');
  press(0,'End');
  assert.equal(tabs[2].attributes['aria-selected'],'true');
  press(2,'Home');
  assert.equal(tabs[0].attributes['aria-selected'],'true');
  tabs[1].handlers.click();
  assert.deepEqual(tabs.map(tab=>tab.tabIndex),[-1,0,-1]);
  assert.deepEqual(panes.map(pane=>pane.hidden),[true,false,true]);
  assert.equal(prevented,4);
});

test('monthly enhancement refreshes yearly totals without duplicate columns or click handlers',()=>{
  const trades=[
    {date:'2026-01-02',currency:'USD',outcome:'WIN',followedPlan:true,pnl:100},
    {date:'2026-01-03',currency:'USD',outcome:'LOSS',followedPlan:false,pnl:-40},
    {date:'2026-01-04',currency:'USD',outcome:'BREAKEVEN',followedPlan:null,pnl:0},
    {date:'2026-01-02',currency:'EUR',outcome:'WIN',followedPlan:true,pnl:20},
    {date:'2025-01-02',currency:'USD',outcome:'LOSS',followedPlan:false,pnl:-10}
  ];
  const body=element(),head=element(),foot=element();
  for(const name of ['Month','Trades','Win rate','Net P&L']){
    head.append(element(name));
    foot.append(element());
  }
  body.closest=()=>({tHead:{rows:[head]},tFoot:{rows:[foot]}});
  const year={value:'2026'},currency={value:'USD'};
  const buttons=Array.from({length:12},()=>element());
  buttons[0].classList.add('is-selected');
  const originalClick=()=>{};
  const renderBase=()=>{
    body.children=[];
    for(let i=0;i<12;i++){
      const prefix=`${year.value}-${String(i+1).padStart(2,'0')}`;
      const items=trades.filter(trade=>trade.currency===currency.value&&trade.date.startsWith(prefix));
      const row=element();
      row.addEventListener('click',originalClick);
      for(const text of [prefix,String(items.length),'rate','P&L'])row.append(element(text));
      body.append(row);
    }
  };
  renderBase();
  let notify;
  vm.runInNewContext(source,{
    document:{
      querySelectorAll:selector=>selector.startsWith('#monthlyPerformance')?buttons:[],
      getElementById:id=>({
        calendarMonthRows:body,'trade-data':{textContent:JSON.stringify(trades)},
        calendarTableYear:year,calendarCurrency:currency
      })[id],
      createElement:()=>element()
    },
    requestAnimationFrame:callback=>callback(),
    MutationObserver:class{constructor(callback){notify=callback}observe(){}}
  });
  assert.equal(head.cells.length,6);
  assert.equal(body.rows[0].cells.length,6);
  assert.equal(foot.cells[2].textContent,'1 / 1');
  assert.equal(foot.cells[4].textContent,'50%');
  assert.equal(body.rows[0].handlers.click,originalClick);
  assert.equal(body.rows[0].attributes.role,undefined);
  assert.equal(body.rows[0].tabIndex,undefined);
  assert.equal(body.rows[0].classList.contains('is-current'),true);
  notify();
  assert.equal(body.rows[0].cells.length,6);
  for(const [selectedYear,selectedCurrency,wl,plan] of [
    ['2026','EUR','1 / 0','100%'],
    ['2025','USD','0 / 1','0%'],
    ['2024','USD','—','—']
  ]){
    year.value=selectedYear;
    currency.value=selectedCurrency;
    renderBase();
    notify();
    assert.equal(head.cells.length,6);
    assert.equal(foot.cells.length,6);
    assert.equal(body.rows[0].cells.length,6);
    assert.equal(foot.cells[2].textContent,wl);
    assert.equal(foot.cells[4].textContent,plan);
    assert.equal(body.rows[0].handlers.click,originalClick);
  }
});
