const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function element(){
  const classes=new Set();
  return {
    children:[],attributes:{},dataset:{},style:{},textContent:'',className:'',
    classList:{add:name=>classes.add(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name)},contains:name=>classes.has(name)},
    append(...children){this.children.push(...children)},
    get childElementCount(){return this.children.filter(child=>typeof child==='object').length},
    replaceChildren(){this.children=[]},
    setAttribute(name,value){this.attributes[name]=value},
    getAttribute(name){return this.attributes[name]},
    addEventListener(name,handler){this[name]=handler},
    focus(){this.focused=true},
    scrollIntoView(){this.scrolled=true},
    querySelectorAll(){return this.children.filter(child=>child.className&&child.className.startsWith('day'))}
  };
}
function calendarNodes(){
  return Object.fromEntries([
    'calendarYears','calendarYearCaption','monthlyPerformance','calendarMonthRows','calendarMonthCurrency','calendarMonthStats',
    'calendarTableYear','calendarMonthTableCaption','calendarYearTrades','calendarYearWinRate','calendarYearPnl',
    'calendarMonthTrades','calendarMonthTradeRows','calendarMonthTradesTitle'
  ].map(id=>[id,element()]));
}
test('calendar displays neutral no-setup dates independently of trade totals and currency',()=>{
  const nodes=calendarNodes();
  const grid=element(),selected=element(),title=element(),monthPnl=element();
  grid.dataset.csrf='csrf-token';
  let analysisRenderCount=0;
  const trades=[{id:'1',date:'2026-11-09',createdAt:'2026-11-09T12:00:00Z',currency:'EUR',outcome:'WIN',pnl:50}];
  const noSetupEntries=[
    {id:'entry1',date:'2026-11-08',notes:'No valid entry'},
    {id:'entry2',date:'2026-11-09',notes:'Waited'},
    {id:'entry3',date:'2026-11-09',notes:'Another entry'},
    {id:'entry4',date:'2024-01-02',notes:'Earlier'}
  ];
  const context=vm.createContext({
    document:{getElementById:id=>nodes[id],createElement:()=>element()},
    Intl,Date,grid,selected,title,monthPnl,trades,noSetupEntries,
    formatPnl:(value,currency)=>`${currency} ${Number(value)>0?'+':''}${Number(value).toFixed(2)}`,
    current:new Date(2026,10,1),calendarYear:2026,calendarToday:'2026-11-12',calendarTimezone:'Europe/Sofia',
    selectedCalendarCurrency:'USD',selectedCalendarDate:'',analysisRange:'day',monthTradesExpanded:false,
    renderAnalysis(){analysisRenderCount++},currencyTotals:()=>new Map(),formatTotals:()=>'',window:{confirm:()=>false}
  });
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('function planAdherence('),source.indexOf("calendarCurrency.addEventListener('change'"));
  vm.runInContext(block,context);
  context.renderCalendar();
  assert.equal(grid.classList.contains('show-weekends'),true);
  assert.ok(nodes.calendarYears.children.some(child=>child.children[0]==='2024  '));
  const day=grid.children.find(child=>child.dataset.date==='2026-11-08');
  assert.equal(day.children[1].textContent,'0 · NO SETUP');
  assert.ok(day.className.includes('neutral'));
  assert.match(day.attributes['aria-label'],/no setup presented/);
  const analysisRendersBeforeSelection=analysisRenderCount;
  day.click();
  assert.equal(analysisRenderCount,analysisRendersBeforeSelection+1);
  assert.equal(context.selectedCalendarDate,'2026-11-08');
  const records=selected.children.find(child=>child.className==='day-records-grid');
  assert.equal(records.children[0].getAttribute('aria-label'),'No-setup entry 1');
  assert.equal(records.children[0].children[0].children[0].textContent,'NO-SETUP ENTRY 01');
  assert.equal(records.children[0].children[1].textContent,'NO SETUP PRESENTED');
  assert.equal(records.children[0].children[3].textContent,'No valid entry');
  const actions=records.children[0].children.at(-1);
  const edit=actions.children[0].children[1];
  assert.equal(edit.action,'/no-setup/entry1/edit');
  assert.equal(edit.children.find(child=>child.name==='returnTo').value,'calendar');
  assert.equal(edit.children.find(child=>child.name==='returnDate').value,'2026-11-08');
  assert.equal(edit.children[3].children[0].value,'2026-11-08');
  assert.equal(edit.children[4].children[0].value,'No valid entry');
  assert.equal(edit.children[0].value,'csrf-token');
  assert.equal(actions.children[1].action,'/no-setup/entry1/delete');
  assert.equal(actions.children[1].children.find(child=>child.name==='returnTo').value,'calendar');
  assert.equal(actions.children[1].children.find(child=>child.name==='returnDate').value,'2026-11-08');
  let prevented=false;
  const cancelForm=actions.children[1];
  cancelForm.submit({preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  assert.equal(nodes.calendarMonthCurrency.textContent,'USD');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='TRADES').children[1].textContent,'0');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WIN RATE').children[1].textContent,'—');
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='AVG TRADE'),false);
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='PROFITABLE DAYS'),false);
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='NO-SETUP ENTRIES'),false);
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST WIN STREAK').children[1].textContent,'0 trades');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WORST LOSS STREAK').children[1].textContent,'0 trades');
  assert.equal(monthPnl.textContent,'$0.00');
  const mixed=grid.children.find(child=>child.dataset.date==='2026-11-09');
  assert.equal(mixed.children[1].textContent,'0 · NO SETUP');
  context.selectedCalendarCurrency='EUR';
  context.renderCalendar();
  assert.equal(nodes.calendarMonthCurrency.textContent,'EUR');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WIN RATE').children[1].textContent,'100%');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WINS').children[1].textContent,'1');
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='AVG TRADE'),false);
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='PROFITABLE DAYS'),false);
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='NO-SETUP ENTRIES'),false);
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST DAY').children[2].textContent,'Mon 9 Nov');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST WIN STREAK').children[1].textContent,'1 trade');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST WIN STREAK').children[2].textContent,'Current · 1 trade');
  const tradeDay=grid.children.find(child=>child.dataset.date==='2026-11-09');
  assert.match(tradeDay.children[1].textContent,/50\.00/);
  assert.equal(tradeDay.children.at(-1).textContent,'NO SETUP');
  tradeDay.click();
  const tradeRecords=selected.children.find(child=>child.className==='day-records-grid');
  const tradeRecord=tradeRecords.children.find(child=>child.className.includes('record-card')&&!child.className.includes('record-even'));
  assert.deepEqual(tradeRecords.children.filter(child=>child.className.includes('record-no-setup'))
    .map(child=>child.children[0].children[0].textContent),['NO-SETUP ENTRY 01','NO-SETUP ENTRY 02']);
  assert.equal(tradeRecord.children[0].children[0].textContent,'TRADE 01');
  assert.equal(tradeRecord.children[0].children[1].textContent,'14:00 · Europe/Sofia');
  assert.ok(tradeRecord.children.find(child=>child.className==='record-chips').children.some(chip=>chip.textContent==='PLAN STATUS UNKNOWN'));
  const accountMeta=tradeRecord.children.find(child=>child.className==='record-meta').children.find(child=>child.className==='record-account');
  assert.equal(accountMeta.children[0],'1× account ');
  assert.equal(accountMeta.children[1].textContent,'(≈ +€50.00 each)');

  context.trades=[
    ...[2092,75,75,75,75].map((pnl,index)=>({
      id:`win${index}`,date:index===0?'2026-11-11':index<3?'2026-11-12':'2026-11-14',
      createdAt:`2026-11-${index===0?'11':index<3?'12':'14'}T0${index}:00:00Z`,currency:'EUR',outcome:'WIN',pnl
    })),
    ...[-2531,-1000,-1000,-416.4].map((pnl,index)=>({
      id:`loss${index}`,date:index===0?'2026-11-13':'2026-11-15',
      createdAt:`2026-11-${index===0?'13':'15'}T0${index}:00:00Z`,currency:'EUR',outcome:'LOSS',pnl
    }))
  ];
  context.renderCalendar();
  assert.equal(monthPnl.textContent,'-€2,555.40');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='TRADES').children[1].textContent,'9');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WINS').children[1].textContent,'5');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='LOSSES').children[1].textContent,'4');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WIN RATE').children[1].textContent,'56%');
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='AVG TRADE'),false);
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='PROFITABLE DAYS'),false);
  assert.equal(nodes.calendarMonthStats.children.some(child=>child.children[0].textContent==='NO-SETUP ENTRIES'),false);
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST DAY').children[1].textContent,'+€2,092.00');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST DAY').children[2].textContent,'Wed 11 Nov');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WORST DAY').children[1].textContent,'-€2,531.00');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WORST DAY').children[2].textContent,'Fri 13 Nov');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST WIN STREAK').children[1].textContent,'3 trades');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST WIN STREAK').children[2].textContent,'Current · 0 trades');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WORST LOSS STREAK').children[1].textContent,'3 trades');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WORST LOSS STREAK').children[2].textContent,'Current · 3 trades');
  context.trades.push({id:'breakeven',date:'2026-11-16',createdAt:'2026-11-16T00:00:00Z',currency:'EUR',outcome:'BREAKEVEN',pnl:0});
  context.renderCalendar();
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='BEST WIN STREAK').children[1].textContent,'3 trades');
  assert.equal(nodes.calendarMonthStats.children.find(child=>child.children[0].textContent==='WORST LOSS STREAK').children[2].textContent,'Current · 0 trades');
});

test('monthly table opens filtered trades, follows year and currency changes, and handles empty months',()=>{
  const nodes=calendarNodes(),grid=element(),selected=element(),title=element(),monthPnl=element();
  const trade=(id,date,pnl,outcome,currency='USD',extra={})=>({
    id,date,createdAt:`${date}T10:00:00Z`,instrument:'TEST',currency,pnl,outcome,...extra
  });
  const trades=[
    trade('1','2026-01-02',100,'WIN','USD',{tradeTime:'09:00'}),
    trade('2','2026-01-02',-40,'LOSS','USD',{tradeTime:'11:00',strategy:'<script>not markup</script>'}),
    trade('3','2026-01-03',0,'BREAKEVEN'),
    trade('4','2026-01-02',999,'WIN','EUR'),
    trade('5','2025-01-05',400,'WIN')
  ];
  const context=vm.createContext({
    document:{getElementById:id=>nodes[id],createElement:()=>element()},
    Intl,Date,grid,selected,title,monthPnl,trades,noSetupEntries:[],
    current:new Date(2026,0,1),calendarYear:2026,calendarToday:'2026-11-14',calendarTimezone:'Europe/Sofia',
    selectedCalendarCurrency:'USD',selectedCalendarDate:'',analysisRange:'month',monthTradesExpanded:false,
    renderAnalysis(){},currencyTotals:()=>new Map(),formatTotals:()=>'',formatPnl:()=>'',window:{confirm:()=>false}
  });
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  vm.runInContext(source.slice(source.indexOf('function planAdherence('),source.indexOf("calendarCurrency.addEventListener('change'")),context);
  context.renderCalendar();
  assert.equal(nodes.calendarMonthRows.children.length,12);
  assert.equal(nodes.calendarMonthRows.children[0].children[0].children[0].textContent,'January 2026');
  assert.equal(nodes.calendarTableYear.value,'2026');
  assert.equal(nodes.calendarYearTrades.textContent,'3');
  assert.equal(nodes.calendarYearWinRate.textContent,'50%');
  assert.equal(nodes.calendarYearPnl.textContent,'+$60.00');
  assert.equal(nodes.calendarMonthTrades.hidden,true);
  nodes.calendarMonthRows.children[0].click();
  assert.equal(nodes.calendarMonthTrades.hidden,false);
  assert.equal(nodes.calendarMonthTradesTitle.textContent,'January 2026 · USD · 3 trades');
  assert.equal(nodes.calendarMonthRows.children[0].children[0].children[0].attributes['aria-expanded'],'true');
  assert.equal(nodes.calendarMonthRows.children[0].children[0].children[0].focused,true);
  const rows=nodes.calendarMonthTradeRows.children;
  assert.equal(rows.length,3);
  assert.equal(rows[0].children[0].children[0].textContent,'2026-01-03 · 12:00');
  assert.equal(rows[1].children[0].children[0].textContent,'2026-01-02 · 11:00');
  assert.equal(rows[1].children[3].textContent,'<script>not markup</script>');
  assert.equal(rows[1].children[5].textContent,'-$40.00');
  rows[1].children[0].children[0].click();
  assert.equal(context.selectedCalendarDate,'2026-01-02');
  assert.equal(selected.scrolled,true);
  assert.equal(selected.children.find(child=>child.className==='day-records-grid').children.length,3);
  context.selectedCalendarCurrency='EUR';
  context.renderCalendar();
  assert.equal(nodes.calendarMonthTradeRows.children.length,1);
  assert.equal(nodes.calendarYearPnl.textContent,'+€999.00');
  context.selectedCalendarCurrency='USD';
  nodes.calendarTableYear.value='2025';
  nodes.calendarTableYear.onchange();
  assert.equal(nodes.calendarTableYear.value,'2025');
  assert.equal(nodes.calendarMonthTradesTitle.textContent,'January 2025 · USD · 1 trade');
  assert.equal(nodes.calendarYearTrades.textContent,'1');
  assert.equal(nodes.calendarYearPnl.textContent,'+$400.00');
  nodes.calendarMonthRows.children[1].click();
  assert.equal(nodes.calendarMonthTradesTitle.textContent,'February 2025 · USD · 0 trades');
  assert.equal(nodes.calendarMonthTradeRows.children[0].children[0].textContent,'No trades recorded for this month and currency.');
});

test('trade previews show account estimates, expandable notes, image previews and working record actions',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const selected=element(),grid=element();
  grid.dataset.csrf='csrf-token';
  const imageBindings=[],edits=[];
  const context=vm.createContext({
    document:{createElement:()=>element()},
    Intl,Date,selected,grid,noSetupEntries:[],calendarTimezone:'Europe/Sofia',
    currencyTotals:items=>new Map([['USD',items.reduce((sum,trade)=>sum+trade.pnl,0)]]),
    formatTotals:()=> 'USD -1054.00',
    analysisRange:'month',renderAnalysis(){},
    bindImagePreview:button=>imageBindings.push(button),
    createTradingViewPreviewButton:(id,label)=>{
      const button=element();
      button.className='image-preview-trigger';
      button.dataset.imageSrc=`https://s3.tradingview.com/snapshots/${id[0].toLowerCase()}/${id}.png`;
      button.setAttribute('aria-label',label);
      button.append(element());
      imageBindings.push(button);
      return button;
    },
    editTrade:id=>edits.push(id),
    window:{confirm:()=>false}
  });
  vm.runInContext(source.slice(source.indexOf('function planAdherence('),source.indexOf('}const calendarNet=')+1),context);
  const notes='Wait for the candle close. '.repeat(15)+'<script>not markup</script>';
  context.showDay('2026-11-13',[{
    id:'trade-1',date:'2026-11-13',tradeTime:'12:22',instrument:'MNQ1!',side:'BUY',
    currency:'USD',outcome:'LOSS',pnl:-1054,account:'APEX',accountCount:5,session:'London',
    emotion:'revenge',followedPlan:false,checklistCompleted:false,planDeviationReason:'Entered too early.',
    strategy:'PHP',notes,images:['image-1','image-2'],tradingViewId:'ZWvJ4X1B'
  }]);
  const record=selected.children.find(child=>child.className==='day-records-grid').children[0];
  assert.equal(record.getAttribute('aria-label'),'Trade 1: MNQ1!');
  assert.equal(record.children[0].children[0].textContent,'TRADE 01');
  assert.equal(record.children[0].children[1].textContent,'12:22 · Europe/Sofia');
  assert.equal(record.children.find(child=>child.className==='calendar-record-head').children[1].children[0].textContent,'-$1,054.00');
  const meta=record.children.find(child=>child.className==='record-meta');
  const account=meta.children.find(child=>child.className==='record-account');
  assert.equal(account.children[0].textContent,'APEX');
  assert.equal(account.children[2],'5× accounts ');
  assert.equal(account.children[3].textContent,'(≈ -$210.80 each)');
  assert.equal(meta.children.find(child=>child.className==='record-strategy').children[1].textContent,'PHP');
  const flags=record.children.find(child=>child.className==='record-chips').children;
  assert.ok(flags.some(flag=>flag.textContent==='PLAN BROKEN'));
  assert.ok(flags.some(flag=>flag.textContent==='CHECKLIST MISSED'));
  const images=record.children.find(child=>child.className==='record-images');
  assert.equal(images.children.length,3);
  assert.equal(imageBindings.length,3);
  assert.equal(imageBindings[0].dataset.imageSrc,'/trades/trade-1/images/image-1');
  assert.equal(imageBindings[0].children[1].textContent,'⤢ ENLARGE');
  assert.equal(imageBindings[2].dataset.imageSrc,'https://s3.tradingview.com/snapshots/z/ZWvJ4X1B.png');
  const note=record.children.find(child=>child.className==='record-note');
  assert.ok(record.children.indexOf(images)<record.children.indexOf(note));
  assert.equal(note.children[1].textContent,notes);
  const more=note.children[2];
  assert.equal(more.getAttribute('aria-expanded'),'false');
  more.click();
  assert.equal(more.getAttribute('aria-expanded'),'true');
  assert.equal(more.textContent,'SHOW LESS');
  assert.equal(note.children[1].classList.contains('is-expanded'),true);
  more.click();
  assert.equal(more.textContent,'SHOW MORE');
  assert.equal(note.children[1].classList.contains('is-expanded'),false);
  const actions=record.children.at(-1);
  actions.children[0].click();
  assert.deepEqual(edits,['trade-1']);
  const deleteForm=actions.children[1];
  assert.equal(deleteForm.action,'/trades/trade-1/delete');
  assert.equal(deleteForm.children.find(child=>child.name==='_csrf').value,'csrf-token');
  assert.equal(deleteForm.children.find(child=>child.name==='returnDate').value,'2026-11-13');
  let prevented=false;
  deleteForm.submit({preventDefault(){prevented=true}});
  assert.equal(prevented,true);
});

test('no-setup records follow the same analysis date ranges as trades',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('function getAnalysisRecords('),source.indexOf('function appendSvg('));
  const context=vm.createContext({current:new Date(2026,10,1),calendarToday:'2026-11-12',analysisRange:'month'});
  vm.runInContext(block,context);
  const records=['2026-10-14','2026-11-05','2026-11-06','2026-11-12','2026-11-13'].map(date=>({date}));
  assert.equal(context.getAnalysisRecords(records).length,4);
  context.analysisRange='7d';
  assert.deepEqual(Array.from(context.getAnalysisRecords(records),entry=>entry.date),['2026-11-06','2026-11-12']);
  context.analysisRange='day';
  context.selectedCalendarDate='2026-11-06';
  assert.deepEqual(Array.from(context.getAnalysisRecords(records),entry=>entry.date),['2026-11-06']);
  context.selectedCalendarDate='';
  assert.equal(context.getAnalysisRecords(records).length,0);
  context.analysisRange='30d';
  assert.equal(context.getAnalysisRecords(records).length,4);
  context.analysisRange='all';
  assert.equal(context.getAnalysisRecords(records).length,5);
  assert.equal(context.getAnalysisRecords([]).length,0);
});
