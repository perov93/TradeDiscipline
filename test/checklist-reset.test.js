const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const session=require('express-session');
const checklistRoutes=require('../routes/checklist');

test('reset clears only the checklist completion and leaves account state unchanged',async t=>{
  const state={
    checks:['rule-1','rule-2'],checkTime:new Date('2026-11-12T10:00:00Z'),
    stopped:false,cooldownUntil:null,saved:false,
    async save(){this.saved=true}
  };
  const user={_id:'user-1'};
  const app=express();
  app.use(express.urlencoded({extended:false}));
  app.use(session({secret:'checklist-reset-test-secret-more-than-32',resave:false,saveUninitialized:true}));
  app.use((req,res,next)=>{req.session.user={id:'user-1'};next()});
  app.use('/check',checklistRoutes({
    User:{async findById(id){assert.equal(id,'user-1');return user}},
    auth:(req,res,next)=>next(),
    async stateFor(foundUser){assert.equal(foundUser,user);return state}
  }));
  const server=await new Promise(resolve=>{const running=app.listen(0,()=>resolve(running))});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/check/reset`,{method:'POST',redirect:'manual'});
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),'/#trade');
  assert.deepEqual(state.checks,[]);
  assert.equal(state.checkTime,null);
  assert.equal(state.stopped,false);
  assert.equal(state.cooldownUntil,null);
  assert.equal(state.saved,true);
});
