const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {Trade,SetupExample}=require('../models');
const {recordReturnTo}=require('../lib/navigation');
const {planFollowUpError}=require('../lib/checklist');

test('A+ markers persist on creation and editing without copying or changing trade state',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  const routes=source.slice(source.indexOf("app.post('/trades',"),source.indexOf("app.get('/trades/:id/images/"));
  const handlers={};
  let trade,events=0,stateSaves=0;
  const state={checks:['rule'],checkTime:new Date(),cooldownUntil:null,async save(){stateSaves++}};
  const context={
    app:{post:(route,...args)=>{handlers[route]=args.at(-1)}},auth(){},receiveTradeImages(){},
    requestImages:()=>[],requestVideos:()=>[],discardRequestImages:async()=>{},imageType:()=>'',storedTradeImages:()=>[],storedTradeVideos:()=>[],
    removeStoredImage:async()=>{},maxTradeImages:10,maxTradeVideos:3,validId:()=>true,
    parseAccountCount:value=>Number(value),validTradeTime:()=>true,SESSION_CHOICES:['auto','New York'],
    resolveTradingSession:()=> 'New York',planFollowUpError,isChecklistComplete:()=>true,
    tradingViewSnapshotId:()=>'',recordReturnTo,
    User:{findById:async()=>({_id:'owner',limits:{cooldownMinutes:15}})},
    Rule:{find:()=>({select:()=>({lean:async()=>[]})})},stateFor:async()=>state,
    Event:{create:async()=>{events++}},
    Trade:{
      create:async value=>{trade={...value,save:async()=>{}};return trade},
      findOne:async query=>query.user==='owner'?trade:null
    },
    fail:(req,message,to)=>({message,to}),console
  };
  vm.runInNewContext(routes,context);
  const body={outcome:'WIN',tradeTime:'09:30',currency:'USD',pnl:'10',accountCount:'1',
    session:'New York',followedPlan:'on',isAPlus:'on'};
  const req={body,session:{user:{id:'owner'}},params:{id:'1'}};
  const res={redirect(url){this.url=url},sendStatus:status=>({status}),status:status=>({send:message=>({status,message})})};
  const next=error=>{throw error};
  await handlers['/trades'](req,res,next);
  assert.equal(trade.isAPlus,true);
  assert.equal(events,1);
  assert.equal(stateSaves,1);
  const edit={...body,followedPlan:'yes',aPlusPresent:'1',returnTo:'setups'};
  delete edit.isAPlus;
  await handlers['/trades/:id/edit']({...req,body:edit},res,next);
  assert.equal(res.url,'/#setups');
  assert.equal(trade.isAPlus,false);
  await handlers['/trades/:id/edit']({...req,body:{...edit,isAPlus:'on'}},res,next);
  assert.equal(trade.isAPlus,true);
  const legacy={...edit};
  delete legacy.aPlusPresent;
  await handlers['/trades/:id/edit']({...req,body:legacy},res,next);
  assert.equal(trade.isAPlus,true);
  let result=await handlers['/trades/:id/edit']({...req,body:{...edit,isAPlus:'invalid'}},res,next);
  assert.match(result.message,/Invalid A\+/);
  assert.equal(trade.isAPlus,true);
  result=await handlers['/trades/:id/edit']({...req,session:{user:{id:'other'}},body:edit},res,next);
  assert.equal(result.status,404);
  assert.equal(events,1);
  assert.equal(stateSaves,1);
});

test('legacy trades are unmarked and separate examples do not acquire a journal marker',()=>{
  assert.equal(new Trade({outcome:'WIN'}).isAPlus,false);
  assert.equal(new SetupExample({title:'Example',outcome:'WIN'}).isAPlus,undefined);
});

test('trade editor restores A+ state and returns to the originating section',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('function editTrade(id,'),source.indexOf("document.querySelectorAll('.trade-edit-trigger')"));
  const fields=Object.fromEntries(['account','accountCount','session','tradeTime','instrument','side','outcome','pnl','currency','strategy','emotion','isAPlus','followedPlan','planDeviationReason','notes','tradingViewUrl'].map(key=>[key,{value:'',checked:false,focus(){}}]));
  const elements={
    tradeReturnTo:{},tradeReturnDate:{},tradeChecklistStatus:{},tradeEditDate:{},
    tradeExistingImage:{replaceChildren(){}}
  };
  const input={value:''},error={hidden:false};
  const editor={updateTradingViewPreview(){},clearImagePreview(){},querySelector:selector=>selector==='[data-image-input]'?input:error};
  const records=new Map([
    ['marked',{id:'marked',date:'2026-11-17',outcome:'WIN',isAPlus:true,images:[]}],
    ['legacy',{id:'legacy',date:'2026-11-16',outcome:'LOSS',images:[]}]
  ]);
  const context={tradeFields:fields,tradeEditor:editor,tradesById:records,selectedCalendarDate:'2026-11-15',
    document:{getElementById:id=>elements[id]},tradeDialog:{showModal(){}},
    updateOutcomePnlWarning(){},updatePlanDeviation(){}};
  vm.runInNewContext(block,context);
  context.editTrade('marked','setups');
  assert.equal(fields.isAPlus.checked,true);
  assert.equal(elements.tradeReturnTo.value,'setups');
  assert.equal(elements.tradeReturnDate.value,'2026-11-17');
  context.editTrade('legacy');
  assert.equal(fields.isAPlus.checked,false);
  assert.equal(elements.tradeReturnTo.value,'calendar');
  assert.equal(elements.tradeReturnDate.value,'2026-11-15');
});
