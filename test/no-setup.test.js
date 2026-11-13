const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const session=require('express-session');
const noSetupRoutes=require('../routes/no-setup');

test('no-setup entries validate, persist, edit and delete only for their owner',async t=>{
  const entries=new Map();
  let nextId=0;
  const NoSetup={
    async create(value){const entry={...value,_id:String(++nextId)};entries.set(entry._id,entry);return entry},
    async findOneAndUpdate(query,update){
      const entry=entries.get(query._id);
      if(!entry||entry.user!==query.user)return null;
      Object.assign(entry,update);
      return entry;
    },
    async findOneAndDelete(query){
      const entry=entries.get(query._id);
      if(!entry||entry.user!==query.user)return null;
      entries.delete(query._id);
      return entry;
    }
  };
  const app=express();
  app.use(express.urlencoded({extended:false}));
  app.use(session({secret:'test-secret-with-more-than-32-characters',resave:false,saveUninitialized:true}));
  app.use((req,res,next)=>{req.session.user={id:req.get('x-user')||'a'};next()});
  app.use('/no-setup',noSetupRoutes({NoSetup,auth:(req,res,next)=>next(),validId:id=>/^\d+$/.test(id)}));
  app.get('/flash',(req,res)=>res.json({error:req.session.error,success:req.session.success}));
  const server=await new Promise(resolve=>{const running=app.listen(0,()=>resolve(running))});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='';
  async function post(url,body={},user='a'){
    const response=await fetch(base+url,{
      method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded','x-user':user,...(cookie?{cookie}:{})},
      body:new URLSearchParams(body)
    });
    cookie=(response.headers.get('set-cookie')||cookie).split(';')[0];
    return response;
  }
  let response=await post('/no-setup',{date:'2026-02-30',notes:'invalid'});
  assert.equal(response.status,302);
  assert.equal(entries.size,0);
  let flash=await (await fetch(base+'/flash',{headers:{cookie}})).json();
  assert.match(flash.error,/valid date/);
  await post('/no-setup',{date:'2026-11-12',notes:'  waited for a setup  '});
  assert.equal(entries.size,1);
  assert.equal(entries.get('1').notes,'waited for a setup');
  response=await post('/no-setup/1/edit',{date:'2026-11-13',notes:'changed'},'b');
  assert.equal(response.status,404);
  assert.equal(entries.get('1').date,'2026-11-12');
  response=await post('/no-setup/1/delete',{},'b');
  assert.equal(response.status,404);
  assert.equal(entries.size,1);
  await post('/no-setup/1/edit',{date:'2024-02-29',notes:'updated'});
  assert.equal(entries.get('1').date,'2024-02-29');
  assert.equal(entries.get('1').notes,'updated');
  response=await post('/no-setup/1/edit',{date:'2024-02-29',notes:'calendar edit',returnTo:'calendar',returnDate:'2024-02-29'});
  assert.equal(response.headers.get('location'),'/?calendarDate=2024-02-29#calendar');
  response=await post('/no-setup/1/edit',{date:'2024-02-29',notes:'unsafe return',returnTo:'https://example.com'});
  assert.equal(response.headers.get('location'),'/#journal');
  await post('/no-setup',{date:'2026-11-12',notes:'x'.repeat(3001)});
  assert.equal(entries.size,1);
  response=await post('/no-setup/1/delete',{returnTo:'calendar'});
  assert.equal(response.headers.get('location'),'/#calendar');
  assert.equal(entries.size,0);
});
