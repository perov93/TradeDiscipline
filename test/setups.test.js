const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const session=require('express-session');
const ejs=require('ejs');
const path=require('path');
const fs=require('node:fs/promises');
const os=require('node:os');
const http=require('node:http');
const setupRoutes=require('../routes/setups');
const {SetupExample,Trade}=require('../models');

test('aborted attachment downloads do not enter error handling, but missing files do',async t=>{
  const imageDirectory=await fs.mkdtemp(path.join(os.tmpdir(),'discipline-attachment-'));
  t.after(()=>fs.rm(imageDirectory,{recursive:true}));
  const imageId='00000000-0000-0000-0000-000000000001';
  const missingId='00000000-0000-0000-0000-000000000002';
  const attachment=await fs.open(path.join(imageDirectory,imageId),'w');
  try{await attachment.truncate(5*1024*1024)}finally{await attachment.close()}
  const app=express();
  const errors=[];
  let resolveClosed;
  const closed=new Promise(resolve=>{resolveClosed=resolve});
  app.use((req,res,next)=>{
    req.session={user:{id:'a'}};
    if(req.get('x-cancel')){
      res.once('close',()=>{
        setImmediate(()=>setImmediate(()=>resolveClosed(res.writableFinished)));
      });
    }
    next();
  });
  app.use('/setups',setupRoutes({
    SetupExample:{findOne:()=>({lean:async()=>({images:[imageId,missingId].map(id=>({id,mime:'image/png'}))})})},
    auth:(req,res,next)=>next(),validId:id=>id==='1',receiveTradeImages:(req,res,next)=>next(),
    storedTradeImages:entry=>entry.images,imageDirectory
  }));
  app.use((err,req,res,next)=>{
    errors.push(err);
    if(res.headersSent)return next(err);
    res.sendStatus(err.status||500);
  });
  const server=await new Promise(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running))});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/setups/1/images/`;
  await new Promise((resolve,reject)=>{
    const request=http.get(base+imageId,{headers:{'x-cancel':'yes'}},response=>{
      response.once('error',reject);
      response.once('data',()=>{
        response.destroy();
        resolve();
      });
    });
    request.once('error',reject);
  });
  assert.equal(await closed,false);
  assert.deepEqual(errors,[]);
  const response=await fetch(base+missingId);
  assert.equal(response.status,404);
  await response.text();
  assert.equal(errors.length,1);
  assert.equal(errors[0].code,'ENOENT');
});

test('setup examples are separate from trades and support owner-scoped create, edit and delete',async t=>{
  const entries=new Map();
  let nextId=0;
  const Model={
    async create(value){
      const entry={...value,_id:String(++nextId),async save(){}};
      entries.set(entry._id,entry);
      return entry;
    },
    findOne(query){
      const entry=entries.get(query._id);
      const result=entry&&entry.user===query.user?entry:null;
      return {then:(resolve,reject)=>Promise.resolve(result).then(resolve,reject),lean:async()=>result};
    },
    async findOneAndDelete(query){
      const entry=await this.findOne(query);
      if(entry)entries.delete(query._id);
      return entry;
    }
  };
  const app=express();
  app.use(express.urlencoded({extended:false}));
  app.use(session({secret:'test-secret-with-more-than-32-characters',resave:false,saveUninitialized:true}));
  app.use((req,res,next)=>{req.session.user={id:req.get('x-user')||'a'};next()});
  const removed=[];
  let discarded=0;
  const uploadedVideoIds=[
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003'
  ];
  let uploadedVideoCount=0;
  app.use('/setups',setupRoutes({
    SetupExample:Model,auth:(req,res,next)=>next(),validId:id=>/^\d+$/.test(id),
    receiveTradeImages:(req,res,next)=>{
      req.files=Array.from({length:Number(req.get('x-image-count')||0)},(_,i)=>({filename:`new-${i}`}));
      req.uploadedVideos=Array.from({length:Number(req.get('x-video-count')||0)},()=>({
        filename:uploadedVideoIds[uploadedVideoCount++],mimetype:'video/mp4'
      }));
      next();
    },requestImages:req=>req.files,requestVideos:req=>req.uploadedVideos,
    discardRequestImages:async()=>{discarded++},removeStoredImage:async id=>removed.push(id),
    storedTradeImages:entry=>entry?.images||[],storedTradeVideos:entry=>entry?.videos||[],
    imageType:()=> 'image/png',videoType:()=> 'video/mp4',imageDirectory:__dirname,
    maxTradeImages:10,maxTradeVideos:3,
    validTradeTime:value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  }));
  const server=await new Promise(resolve=>{const running=app.listen(0,()=>resolve(running))});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const data={title:'Opening range',session:'New York',tradeTime:'09:45',
    instrument:'ES',side:'BUY',outcome:'LOSS',currency:'usd',strategy:'Breakout',
    notes:'Wait for confirmation',tradingViewUrl:'https://www.tradingview.com/x/AbCd1234/'};
  async function post(url,body,user='a',headers={}){
    return fetch(base+url,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded','x-user':user,...headers},body:new URLSearchParams(body)});
  }
  let response=await post('/setups',data);
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),'/#setups');
  assert.equal(entries.size,1);
  assert.equal(entries.get('1').currency,'USD');
  assert.equal(entries.get('1').tradingViewId,'AbCd1234');
  assert.equal(entries.get('1').outcome,'LOSS');
  for(const key of ['accountCount','pnl','emotion','followedPlan'])assert.equal(entries.get('1')[key],null);
  response=await post('/setups',{...data,title:''});
  assert.equal(response.status,400);
  assert.match(await response.text(),/setup name/);
  response=await post('/setups',{...data,tradeTime:'invalid'});
  assert.equal(response.status,400);
  assert.equal(entries.size,1);
  response=await post('/setups/1/edit',{...data,title:'Not yours'},'b');
  assert.equal(response.status,404);
  response=await post('/setups/1/delete',{},'b');
  assert.equal(response.status,404);
  const imageId='00000000-0000-0000-0000-000000000000';
  Object.assign(entries.get('1'),{account:'Old account',accountCount:2,pnl:-20,emotion:'fomo',followedPlan:false,planDeviationReason:'Legacy reason'});
  entries.get('1').images=[{id:imageId,mime:'image/png'}];
  const discardedBefore=discarded;
  response=await fetch(base+'/setups/1/images/00000000-0000-0000-0000-000000000000',{headers:{'x-user':'b'}});
  assert.equal(response.status,404);
  response=await fetch(base+'/setups/1/edit',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded','x-image-count':'10'},body:new URLSearchParams(data)});
  assert.equal(response.status,400);
  assert.match(await response.text(),/up to 10 images/);
  assert.equal(discarded,discardedBefore+1);
  assert.equal(entries.get('1').images.length,1);
  response=await post('/setups/1/edit',{...data,title:'Updated',removeImages:imageId});
  assert.equal(response.status,302);
  assert.equal(entries.get('1').title,'Updated');
  assert.deepEqual(
    ['account','accountCount','pnl','emotion','followedPlan','planDeviationReason'].map(key=>entries.get('1')[key]),
    ['Old account',2,-20,'fomo',false,'Legacy reason']
  );
  assert.deepEqual(removed,[imageId]);
  response=await post('/setups/1/delete',{returnTo:'setup-library'});
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),'/setup-library');
  assert.equal(entries.size,0);
  assert.equal((await post('/setups',data)).status,302);
  response=await post('/setups/2/delete',{returnTo:'https://example.com'});
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),'/#setups');
  assert.equal(entries.size,0);

  response=await post('/setups',data,'a',{'x-video-count':'2'});
  assert.equal(response.status,302);
  const videoSetupId=String(nextId);
  assert.deepEqual(entries.get(videoSetupId).videos.map(video=>video.mime),['video/mp4','video/mp4']);
  const videoUrl=`${base}/setups/${videoSetupId}/videos/${uploadedVideoIds[1]}`;
  response=await fetch(videoUrl,{headers:{'x-user':'b'}});
  assert.equal(response.status,404);
  response=await post(`/setups/${videoSetupId}/edit`,{...data,removeVideos:uploadedVideoIds[0]},'a',{'x-video-count':'1'});
  assert.equal(response.status,302);
  assert.deepEqual(entries.get(videoSetupId).videos.map(video=>video.id),[uploadedVideoIds[1],uploadedVideoIds[2]]);
  assert.ok(removed.includes(uploadedVideoIds[0]));
  response=await post(`/setups/${videoSetupId}/delete`,{});
  assert.equal(response.status,302);
  assert.ok(removed.includes(uploadedVideoIds[1]));
  assert.ok(removed.includes(uploadedVideoIds[2]));
});

test('setup form omits removed fields and escapes saved example content',async()=>{
  const html=await ejs.renderFile(path.join(__dirname,'..','views','setup-form.ejs'),{
    setup:{_id:'1',title:'<script>',accountCount:1,session:'New York',tradeTime:'09:30',
      outcome:'WIN',currency:'USD',followedPlan:true,images:[]},
    csrf:'token',sessionChoices:['auto','New York'],user:{timezone:'UTC'},
    preferences:{defaultCurrency:'USD'},timeKey:()=> '09:30',maxTradeVideos:3,maxVideoBytes:1e9
  });
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/MAX 1 GB EACH/);
  for(const name of ['title','session','tradeTime','instrument','side','outcome','currency','strategy','notes','tradingViewUrl','images','videos']){
    assert.match(html,new RegExp(`name="${name}"`));
  }
  for(const name of ['account','accountCount','pnl','emotion','followedPlan','planDeviationReason']){
    assert.doesNotMatch(html,new RegExp(`name="${name}"`));
  }
  assert.doesNotMatch(html,/data-plan-follow-up|data-outcome-pnl/);
  const user='507f1f77bcf86cd799439011';
  assert.equal(new SetupExample({title:'Example',user,outcome:'WIN',accountCount:null,pnl:null,emotion:null,followedPlan:null}).validateSync(),undefined);
  assert.equal(new SetupExample({title:'Video example',user,outcome:'WIN',videos:[{id:'10000000-0000-0000-0000-000000000001',mime:'video/webm'}]}).validateSync(),undefined);
  assert.ok(new SetupExample({title:'Invalid video',user,outcome:'WIN',videos:[{id:'10000000-0000-0000-0000-000000000001',mime:'video/quicktime'}]}).validateSync().errors['videos.0.mime']);
  assert.equal(new Trade({user,outcome:'WIN',videos:[{id:'10000000-0000-0000-0000-000000000001',mime:'video/mp4'}]}).validateSync(),undefined);
  assert.ok(new Trade({user,outcome:'WIN',accountCount:null}).validateSync().errors.accountCount);
});

test('setup details do not invent results or account and plan data',async()=>{
  const base={_id:'1',title:'Example',createdAt:new Date(),tradeTime:'09:30',
    outcome:'WIN',currency:'USD',session:'New York',images:[]};
  const render=record=>ejs.renderFile(path.join(__dirname,'..','views','setup-record.ejs'),{
    item:{record,isJournal:false},date:'2026-11-17',libraryPage:true,user:{timezone:'UTC'},csrf:'test-csrf',
    timeKey:()=> '09:30',fmtPnl:value=>`P&L ${value}`,pnlClass:()=> ''
  });
  let html=await render({...base,accountCount:null,pnl:null,emotion:null,followedPlan:null});
  assert.match(html,/>—<\/span>/);
  assert.doesNotMatch(html,/P&amp;L 0|account\(s\)|Plan followed|Emotion not recorded/);
  assert.match(html,/<span class="record-chip record-chip-good">WIN<\/span>/);
  assert.match(html,/<span class="record-chip">Instrument not specified<\/span>/);
  assert.match(html,/<span class="record-chip">New York<\/span>/);
  assert.match(html,/<span class="record-chip">USD<\/span>/);
  assert.doesNotMatch(html,/setup-record-note/);
  html=await render({...base,videos:[{id:'10000000-0000-0000-0000-000000000001',mime:'video/mp4'}]});
  assert.match(html,/data-video-src="\/setups\/1\/videos\/10000000-0000-0000-0000-000000000001"/);
  assert.match(html,/data-video-mime="video\/mp4"/);
  html=await render({...base,account:'Old account',accountCount:2,pnl:-20,emotion:'fomo',followedPlan:false,planDeviationReason:'Legacy reason'});
  assert.match(html,/P&amp;L -20/);
  assert.match(html,/Old account/);
  assert.match(html,/Plan broken/);
  assert.match(html,/Legacy reason/);
  html=await render({...base,outcome:'LOSS',instrument:'<MES>',side:'SELL',session:null,notes:'Clean PHP Signal\n<Nice volume candle>'});
  assert.match(html,/<span class="record-chip record-chip-bad">LOSS<\/span>/);
  assert.match(html,/<span class="record-chip">&lt;MES&gt;<\/span>/);
  assert.match(html,/<span class="record-chip record-chip-bad">SELL<\/span>/);
  assert.match(html,/<span class="record-chip">Session not recorded<\/span>/);
  assert.match(html,/<span class="record-label">LESSON \/ NOTES<\/span>\s*<p>Clean PHP Signal\n&lt;Nice volume candle&gt;<\/p>/);
});
