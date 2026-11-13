const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const session=require('express-session');
const bcrypt=require('bcryptjs');
const fs=require('node:fs');
const path=require('node:path');
const ejs=require('ejs');
const {User}=require('../models');
const {
  DEFAULT_PREFERENCES,preferencesFor,validateSettings,scheduleDiscipline,
  applyPendingSettings,TIMEZONES,CURRENCIES
}=require('../lib/settings');
const {SESSION_CHOICES}=require('../lib/market-sessions');
const settingsRoutes=require('../routes/settings');
const body=overrides=>({
  name:'Test Trader',timezone:'Europe/Sofia',maxTrades:'5',maxLosses:'3',cooldownMinutes:'20',
  defaultCurrency:'EUR',calendarCurrency:'EUR',analysisRange:'7d',defaultTab:'calendar',
  showWorldClocks:'on',showForexHours:'on',showNyReminder:'on',showEconomicCalendar:'on',...overrides
});

test('legacy accounts receive defaults and false preferences remain false',()=>{
  assert.deepEqual(preferencesFor({}),DEFAULT_PREFERENCES);
  assert.equal(preferencesFor({preferences:{showForexHours:false}}).showForexHours,false);
  assert.equal(preferencesFor({preferences:{showMotivationalMessage:false}}).showMotivationalMessage,false);
  assert.equal(preferencesFor({preferences:{motivationalMessage:''}}).motivationalMessage,DEFAULT_PREFERENCES.motivationalMessage);
  assert.equal(preferencesFor({preferences:{motivationalMessage:'My own reminder'}}).motivationalMessage,'My own reminder');
  const user=new User({name:'Test',email:'test@example.invalid',passwordHash:'hash'});
  assert.deepEqual(user.preferences.toObject(),DEFAULT_PREFERENCES);
});
test('settings validation rejects invalid numbers, zones, currencies and preferences',()=>{
  assert.equal(validateSettings(body()).value.preferences.defaultCurrency,'EUR');
  for(const invalid of [
    {maxTrades:'0'},{maxTrades:'101'},{maxTrades:'3.5'},{maxTrades:['5']},
    {maxLosses:'-1'},{cooldownMinutes:'241'},{cooldownMinutes:'Infinity'},
    {timezone:'Mars/Olympus'},{timezone:[]},{defaultCurrency:'XYZ'},
    {calendarCurrency:'<script>'},{defaultTab:'admin'},{analysisRange:'year'},
    {name:'x'},{showForexHours:'false'},{motivationalMessage:'x'.repeat(501)}
  ])assert.ok(validateSettings(body(invalid)).error,JSON.stringify(invalid));
  assert.equal(validateSettings(body({motivationalMessage:'  Stay focused.  '})).value.preferences.motivationalMessage,'Stay focused.');
  assert.equal(validateSettings(body({motivationalMessage:''})).value.preferences.motivationalMessage,'');
  assert.equal(validateSettings(body({showForexHours:undefined})).value.preferences.showForexHours,false);
  assert.equal(validateSettings(body({showEconomicCalendar:undefined})).value.preferences.showEconomicCalendar,false);
  assert.equal(validateSettings(body({showMotivationalMessage:undefined})).value.preferences.showMotivationalMessage,false);
  assert.equal(validateSettings(body({showMotivationalMessage:'on'})).value.preferences.showMotivationalMessage,true);
  assert.ok(validateSettings(body({showEconomicCalendar:'yes'})).error);
});
test('discipline changes keep their original deadline; active values cancel pending edits',()=>{
  const effectiveAt=new Date('2026-11-10T22:00:00Z');
  const original={timezone:'Europe/Sofia',limits:{maxTrades:3,maxLosses:2,cooldownMinutes:15}};
  const settings=validateSettings(body()).value;
  const pending=scheduleDiscipline(original,settings,effectiveAt);
  assert.equal(pending.effectiveAt,effectiveAt);
  assert.equal(original.limits.maxTrades,3);
  const revised=scheduleDiscipline({...original,pendingSettings:pending},settings,new Date('2026-11-11T22:00:00Z'));
  assert.equal(revised.effectiveAt,effectiveAt);
  assert.equal(scheduleDiscipline(original,{timezone:original.timezone,limits:original.limits},effectiveAt),null);
});
test('pending timezone and limits only become active at the saved deadline',async()=>{
  let saves=0;
  const user={
    timezone:'Europe/Sofia',limits:{maxTrades:3,maxLosses:2,cooldownMinutes:15},
    pendingSettings:{timezone:'America/New_York',limits:{maxTrades:5,maxLosses:3,cooldownMinutes:20},effectiveAt:new Date('2026-11-10T22:00:00Z')},
    async save(){saves++}
  };
  await applyPendingSettings(user,new Date('2026-11-10T21:59:59Z'));
  assert.equal(user.limits.maxTrades,3);
  assert.equal(saves,0);
  await applyPendingSettings(user,new Date('2026-11-10T22:00:00Z'));
  assert.equal(user.timezone,'America/New_York');
  assert.equal(user.limits.maxTrades,5);
  assert.equal(user.pendingSettings,null);
  assert.equal(saves,1);
});

test('settings routes persist only the authenticated user and protect discipline state',async t=>{
  const users=new Map();
  for(const id of ['a','b'])users.set(id,{
    _id:id,name:'Original',timezone:'Europe/Sofia',limits:{maxTrades:3,maxLosses:2,cooldownMinutes:15},
    passwordHash:await bcrypt.hash('original-password',4),preferences:{...DEFAULT_PREFERENCES},
    pendingSettings:null,async save(){this.saved=true}
  });
  const state={stopped:true,cooldownUntil:new Date(Date.now()+3600000),checks:['rule']};
  const snapshot=JSON.stringify(state);
  const app=express();
  app.use(express.urlencoded({extended:false}));
  app.use(session({secret:'test-only-session-secret-32-characters',resave:false,saveUninitialized:false}));
  app.post('/test-login',(req,res)=>{
    req.session.user={id:req.body.id,name:'Original'};
    req.session.csrf='test-token';
    res.sendStatus(204);
  });
  app.get('/test-session',(req,res)=>res.json({user:req.session.user,error:req.session.error,success:req.session.success}));
  app.use('/settings',(req,res,next)=>{
    if(req.body._csrf!=='test-token')return res.sendStatus(403);
    next();
  });
  app.use('/settings',settingsRoutes({
    User:{findById:async id=>users.get(id)},
    auth:(req,res,next)=>req.session.user?next():res.sendStatus(401),
    stateFor:async()=>state,
    startOfNextDay:()=>new Date('2099-01-01T22:00:00Z')
  }));
  const server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener))});
  t.after(()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const base=`http://127.0.0.1:${server.address().port}`;
  let cookie='';
  async function post(url,data){
    const response=await fetch(base+url,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:cookie},body:new URLSearchParams(data)});
    const setCookie=response.headers.get('set-cookie');
    if(setCookie)cookie=setCookie.split(';')[0];
    await response.text();
    return response;
  }
  assert.equal((await post('/settings',{...body(),_csrf:'test-token'})).status,401);
  await post('/test-login',{id:'a'});
  assert.equal((await post('/settings',body())).status,403);
  let response=await post('/settings',{...body(),_csrf:'test-token',user:'b'});
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),'/#settings');
  assert.equal(users.get('a').preferences.defaultCurrency,'EUR');
  assert.equal(users.get('a').limits.maxTrades,3);
  assert.equal(users.get('a').pendingSettings.limits.maxTrades,5);
  assert.equal(users.get('b').saved,undefined);
  assert.equal(users.get('b').preferences.defaultCurrency,'USD');
  assert.equal(JSON.stringify(state),snapshot);
  await post('/settings',{...body({maxTrades:'0'}),_csrf:'test-token'});
  assert.equal(users.get('a').pendingSettings.limits.maxTrades,5);
  let current=await (await fetch(base+'/test-session',{headers:{Cookie:cookie}})).json();
  assert.ok(current.error.includes('maxTrades'));
  const originalHash=users.get('a').passwordHash;
  await post('/settings/password',{_csrf:'test-token',currentPassword:'wrong-password',newPassword:'replacement-password',confirmPassword:'replacement-password'});
  assert.equal(users.get('a').passwordHash,originalHash);
  await post('/settings/password',{_csrf:'test-token',currentPassword:'original-password',newPassword:'replacement-password',confirmPassword:'replacement-password'});
  assert.ok(await bcrypt.compare('replacement-password',users.get('a').passwordHash));
  assert.ok(await bcrypt.compare('original-password',users.get('b').passwordHash));
  current=await (await fetch(base+'/test-session',{headers:{Cookie:cookie}})).json();
  assert.equal(current.user.id,'a');
  assert.ok(current.success.includes('Password changed'));
  assert.equal(JSON.stringify(state),snapshot);
});

test('dashboard renders saved settings, hidden widgets and existing accounts',()=>{
  const user=new User({
    name:'Test Trader',email:'test@example.invalid',passwordHash:'hidden',
    preferences:{defaultCurrency:'EUR',calendarCurrency:'GBP',defaultTab:'calendar',analysisRange:'30d',showWorldClocks:false,showForexHours:false,showNyReminder:false,showEconomicCalendar:false}
  });
  const locals={
    user,csrf:'test-token',me:{name:user.name},error:null,success:'Saved',
    preferencesFor,settingsTimezones:TIMEZONES,settingsCurrencies:CURRENCIES,sessionChoices:SESSION_CHOICES,
    state:{checks:[],cooldownUntil:null,stopped:false},rules:[],trades:[],pnlTotals:[],
    todays:[],losses:0,locked:false,lockReason:'',cooldown:false,availableAt:null,
    availableAtLabel:null,availableAtBulgariaLabel:null,availableAtNyLabel:null,
    nySession:{phase:'Waiting',milestone:'Next',schedule:[]},
    active:[],checks:[],checklistCompleted:false,today:'2026-11-10',dayKey:()=> '2026-11-10',timeKey:()=> '12:34',limits:user.limits
  };
  const template=fs.readFileSync(path.join(__dirname,'..','views','dashboard.ejs'),'utf8');
  let html=ejs.render(template,locals);
  assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg\?v=1">/);
  assert.match(html,/data-default-tab="calendar"/);
  assert.match(html,/data-default-currency="GBP" data-analysis-range="30d"/);
  assert.match(html,/name="currency"[^>]+value="EUR"/);
  assert.match(html,/id="tradeSession"/);
  assert.match(html,/type="time" name="tradeTime" value="12:34" required/);
  assert.match(html,/data-image-upload data-plan-follow-up data-outcome-pnl/);
  assert.match(html,/<option value="" selected disabled>Choose an outcome<\/option>/);
  assert.match(html,/id="tradeReturnTo" value="calendar"/);
  assert.match(html,/<option value="unknown">Not recorded<\/option>/);
  assert.match(html,/value="London \/ New York">London \/ New York<\/option>/);
  assert.match(html,/No completed checklist is recorded today/);
  assert.match(html,/name="planDeviationReason"[^>]+required/);
  assert.match(html,/name="motivationalMessage"/);
  assert.match(html,/name="showMotivationalMessage" checked/);
  user.preferences.motivationalMessage='Stay patient and follow the plan.';
  locals.checklistCompleted=true;
  html=ejs.render(template,locals);
  assert.match(html,/Stay patient and follow the plan\./);
  assert.match(html,/YOUR DASHBOARD MESSAGE/);
  user.preferences.showMotivationalMessage=false;
  html=ejs.render(template,locals);
  assert.ok(!html.includes('<aside class="motivation-panel"'));
  assert.match(html,/name="motivationalMessage"[^>]*>Stay patient and follow the plan\./);
  assert.match(html,/name="showMotivationalMessage"\s*> SHOW MOTIVATIONAL MESSAGE ON DASHBOARD/);
  user.preferences.showMotivationalMessage=true;
  assert.ok(!html.includes('No completed checklist is recorded today'));
  assert.match(html,/id="journalFollowedPlan" checked/);
  assert.ok(!html.includes('id="fxSessionGrid"'));
  assert.ok(!html.includes('id="nySessionTimer"'));
  assert.ok(!html.includes('data-world-clock'));
  assert.match(html,/action="\/settings\/password"/);
  user.preferences=undefined;
  html=ejs.render(template,locals);
  assert.match(html,/id="fxSessionGrid"/);
  assert.match(html,/id="nySessionTimer"/);
  assert.doesNotMatch(html,/NEXT EVENT · LOCAL TIME DETAILS/);
  assert.match(html,/<div class="ny-live-banner" id="nyLiveBanner" role="status" hidden>/);
  for(const [phase,label] of [
    ['PRE-MARKET IS OPEN','PRE-MARKET OPEN'],
    ['REGULAR NY SESSION','NY SESSION OPEN']
  ]){
    const liveHtml=ejs.render(template,{...locals,nySession:{...locals.nySession,phase}});
    assert.match(liveHtml,/<div class="ny-live-banner" id="nyLiveBanner" role="status">/);
    assert.ok(liveHtml.includes(`<strong id="nyLiveLabel">${label}</strong>`));
  }
  const rules=[{_id:'rule-1',active:true,title:'Follow the plan'},{_id:'rule-2',active:true,title:'Manage risk'}];
  const todays=[
    {_id:'trade-1',createdAt:new Date('2026-11-10T10:00:00Z'),instrument:'XAUUSD',side:'BUY',outcome:'WIN',pnl:112.4,currency:'USD',accountCount:5},
    {_id:'trade-2',createdAt:new Date('2026-11-10T11:00:00Z'),instrument:'EURUSD',side:'SELL',outcome:'LOSS',pnl:-20,currency:'EUR'}
  ];
  const cardLocals={...locals,rules,active:rules,checks:['rule-1'],todays,trades:todays,losses:1};
  const readyHtml=ejs.render(template,cardLocals);
  assert.match(readyHtml,/"followedPlan":null/);
  assert.match(readyHtml,/name="accountCount"[^>]+value="5"/);
  assert.match(readyHtml,/name="accountCount" id="tradeAccountCount"[^>]+value="1"/);
  assert.match(readyHtml,/COMBINED P&amp;L/);
  assert.match(readyHtml,/5× accounts · approx \+22\.48 USD \/ account/);
  assert.match(readyHtml,/"accountCount":5/);
  const noSetupHtml=ejs.render(template,{...cardLocals,noSetupEntries:[{_id:'entry1',date:'2026-11-10',notes:'<script>unsafe</script>'}]});
  assert.match(noSetupHtml,/NO SETUP PRESENTED · ADD ENTRY/);
  assert.match(noSetupHtml,/action="\/no-setup\/entry1\/edit"/);
  assert.match(noSetupHtml,/action="\/no-setup\/entry1\/delete"/);
  assert.match(noSetupHtml,/&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.match(noSetupHtml,/not included in the trade CSV/);
  assert.match(readyHtml,/READY TO TRADE/);
  assert.match(readyHtml,/<strong id="checklistProgressValue">1 of 2<\/strong><a class="card-link" href="#trade">OPEN →<\/a>/);
  assert.match(readyHtml,/<div class="time-conversion checklist-summary">\s*<div class="card-row"><span>CHECKLIST<\/span><div class="checklist-summary-value">/);
  assert.match(readyHtml,/id="checklistProgress"[^>]+aria-valuenow="1">[\s\n]*<i class="is-filled"><\/i><i class=""><\/i>/);
  assert.match(readyHtml,/\+112\.40 USD/);
  assert.match(readyHtml,/−20\.00 EUR/);
  assert.match(readyHtml,/EURUSD · SELL/);
  assert.match(readyHtml,/<div class="time-conversion account-today">/);
  assert.match(readyHtml,/aria-label="Trades left today"[^>]+aria-valuenow="1"/);
  const lockedHtml=ejs.render(template,{...cardLocals,locked:true,lockReason:'Emergency stop',availableAt:new Date('2026-11-11T00:00:00Z'),availableAtLabel:'midnight',availableAtNyLabel:'New York',availableAtBulgariaLabel:'Bulgaria'});
  assert.match(lockedHtml,/DAILY ACCOUNT LOCK/);
  assert.match(lockedHtml,/Emergency stop/);
  assert.match(lockedHtml,/data-until=/);
  assert.doesNotMatch(lockedHtml,/READY TO TRADE/);
  const completedHtml=ejs.render(template,{...locals,state:{checks:['rule-1'],checkTime:new Date()},checks:['rule-1'],active:[{_id:'rule-1'}],checklistCompleted:true});
  assert.match(completedHtml,/action="\/check\/reset"/);
  assert.match(completedHtml,/RESET CHECKLIST · NO TRADE/);
  const incompleteHtml=ejs.render(template,{...locals,checklistCompleted:false});
  assert.ok(!incompleteHtml.includes('action="/check/reset"'));
  assert.match(html,/class="ny-timeline-track"[\s\S]*class="ny-timeline-scale"[\s\S]*<\/div>\s*<div class="ny-session-times"/);
  assert.match(html,/data-world-clock/);
  const legacyLocals={...locals};
  delete legacyLocals.preferencesFor;
  delete legacyLocals.settingsTimezones;
  delete legacyLocals.settingsCurrencies;
  delete legacyLocals.success;
  html=ejs.render(template,legacyLocals);
  assert.match(html,/Restart the app server to enable saving settings/);
  assert.match(html,/class="primary" disabled>SAVE MY SETTINGS/);
});

test('login page shows the dedication but registration page does not',()=>{
  const template=fs.readFileSync(path.join(__dirname,'..','views','auth.ejs'),'utf8');
  const login=ejs.render(template,{register:false,csrf:'test-token',error:null});
  const register=ejs.render(template,{register:true,csrf:'test-token',error:null});
  for(const html of [login,register]){
    assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg\?v=1">/);
  }
  assert.match(login,/For my wife, Desislava Vasileva/);
  assert.doesNotMatch(register,/Desislava Vasileva/);
});
