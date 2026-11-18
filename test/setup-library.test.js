const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const path=require('path');
const setupLibraryRoutes=require('../routes/setup-library');

test('library paginates mixed owner-scoped records and applies filters across both sources',async t=>{
  const examples=[],trades=[];
  for(let i=0;i<105;i++){
    const record={_id:String(i).padStart(3,'0'),user:'a',createdAt:new Date(Date.UTC(2026,0,1,0,i===103?104:i)),
      instrument:`Instrument-${i}`,strategy:i===1?'BreakXout':i%3===0?'Break.out':'Pullback',outcome:i%4===0?'LOSS':'WIN',
      pnl:i,currency:'USD',tradeTime:'09:30',side:'BUY',session:'London',account:'Demo',notes:'',images:[]};
    if(i%2===0)examples.push({...record,title:`Example-${i}`});
    else trades.push({...record,instrument:`Trade-${i}`,isAPlus:true});
  }
  examples.push({...examples[0],_id:'other',user:'b',title:'OTHER USER SECRET'});
  trades.push({...trades[0],_id:'unmarked',instrument:'UNMARKED TRADE',isAPlus:false});
  examples.push({...examples[0],_id:'c1',user:'c',title:'START',createdAt:new Date('2025-12-31T22:00:00Z')});
  trades.push({...trades[0],_id:'c2',user:'c',instrument:'MIDDLE',createdAt:new Date('2026-01-02T21:59:59Z')});
  examples.push({...examples[0],_id:'c3',user:'c',title:'AFTER',createdAt:new Date('2026-01-02T22:00:00Z')});
  const limits=[];
  function model(records){
    function matches(record,query){
      return Object.entries(query).every(([key,value])=>{
        if(key==='$or')return value.some(condition=>matches(record,condition));
        if(value && typeof value==='object' && '$gte' in value){
          return record[key]>=value.$gte&&record[key]<value.$lt;
        }
        if(value && typeof value==='object' && '$regex' in value){
          return new RegExp(value.$regex,value.$options).test(record[key]||'');
        }
        return record[key]===value;
      });
    }
    return {
      countDocuments:async query=>records.filter(record=>matches(record,query)).length,
      find(query){
        let rows=records.filter(record=>matches(record,query));
        return {
          sort(){rows=rows.sort((a,b)=>b.createdAt-a.createdAt||b._id.localeCompare(a._id));return this},
          limit(value){limits.push(value);rows=rows.slice(0,value);return this},
          async lean(){return rows}
        };
      }
    };
  }
  const app=express();
  app.set('view engine','ejs');
  app.set('views',path.join(__dirname,'..','views'));
  app.use((req,res,next)=>{req.session={user:{id:req.get('x-user')||'a'}};next()});
  app.use('/setup-library',setupLibraryRoutes({
    SetupExample:model(examples),Trade:model(trades),User:{findById:async id=>({_id:id,timezone:id==='c'?'Europe/Sofia':'UTC'})},
    auth:(req,res,next)=>next(),
    dayKey:(date,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(date),timeKey:()=> '09:30',
    zonedTime:(date,hour,minute,tz)=>new Date(Date.parse(`${date}T${String(hour).padStart(2,'0')}:00:00Z`)-(tz==='Europe/Sofia'?2*3600000:0)),
    startOfNextDay:(date,tz)=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+(tz==='Europe/Sofia'?0:1),tz==='Europe/Sofia'?22:0))
  }));
  const server=await new Promise(resolve=>{const running=app.listen(0,()=>resolve(running))});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/setup-library`;
  let html=await (await fetch(base)).text();
  assert.match(html,/105 RECORDS/);
  assert.match(html,/<summary aria-label="Save dates: All save dates"[^>]*>All save dates<\/summary>/);
  assert.match(html,/<label>FROM<input type="date" name="from"/);
  assert.match(html,/<label>TO \(OPTIONAL\)<input type="date" name="to"/);
  assert.match(html,/20 on this page/);
  assert.match(html,/setup-record-outcome-win">WIN<\/span>/);
  assert.match(html,/setup-record-outcome-loss">LOSS<\/span>/);
  assert.match(html,/class="setup-library-table-head"[^>]*>.*TIME.*SETUP.*SIDE.*INSTR\..*SESSION.*STRATEGY.*RESULT.*P&amp;L/);
  assert.match(html,/aria-label="Side: BUY">BUY<\/span>/);
  assert.match(html,/aria-label="Instrument: Instrument-104">Instrument-104<\/span>/);
  assert.match(html,/aria-label="Session: London">London<\/span>/);
  assert.match(html,/href="\/\?setupId=104#setups">EDIT OR DELETE EXAMPLE/);
  assert.match(html,/href="\/\?calendarDate=2026-01-01#calendar">OPEN TRADE IN CALENDAR/);
  assert.match(html,/PAGE 1 OF 6/);
  assert.equal((html.match(/<details class="setup-record"/g)||[]).length,20);
  assert.ok(html.indexOf('Example-104')<html.indexOf('Trade-103'));
  assert.match(html,/Example-86/);
  assert.match(html,/Trade-85/);
  assert.doesNotMatch(html,/Example-84|OTHER USER SECRET|UNMARKED TRADE/);
  assert.deepEqual(limits,[20,20]);
  html=await (await fetch(base+'?page=2')).text();
  assert.match(html,/PAGE 2 OF 6/);
  assert.match(html,/Example-84/);
  assert.doesNotMatch(html,/Example-86/);
  html=await (await fetch(base+'?page=999')).text();
  assert.match(html,/PAGE 6 OF 6/);
  assert.equal((html.match(/<details class="setup-record"/g)||[]).length,5);
  assert.match(html,/Example-0/);
  const filters='?type=example&strategy=break.out&instrument=instrument&outcome=LOSS';
  html=await (await fetch(base+filters)).text();
  assert.match(html,/9 RECORDS/);
  assert.match(html,/Example-0/);
  assert.doesNotMatch(html,/JOURNAL TRADE|Example-4\s*</);
  html=await (await fetch(base+'?search=Break.out&type=trade')).text();
  assert.match(html,/JOURNAL TRADE/);
  assert.doesNotMatch(html,/SAVED EXAMPLE/);
  assert.doesNotMatch(html,/Trade-1\s*</);
  html=await (await fetch(base+'?search=BreakXout')).text();
  assert.match(html,/1 RECORDS/);
  html=await (await fetch(base+'?search=does-not-exist')).text();
  assert.match(html,/NO MATCHING SETUPS/);
  assert.match(html,/No setups match these filters/);
  html=await (await fetch(base+'?type=trade')).text();
  assert.match(html,/type=trade&amp;page=2/);
  html=await (await fetch(base,{headers:{'x-user':'b'}})).text();
  assert.match(html,/OTHER USER SECRET/);
  assert.doesNotMatch(html,/Example-104/);
  html=await (await fetch(base+'?from=2026-01-01',{headers:{'x-user':'c'}})).text();
  assert.match(html,/<summary aria-label="Save dates: 2026-01-01"[^>]*>2026-01-01<\/summary>/);
  assert.match(html,/START/);
  assert.doesNotMatch(html,/MIDDLE|AFTER/);
  html=await (await fetch(base+'?from=2026-01-01&to=2026-01-02',{headers:{'x-user':'c'}})).text();
  assert.match(html,/<summary aria-label="Save dates: 2026-01-01 – 2026-01-02"[^>]*>2026-01-01 – 2026-01-02<\/summary>/);
  assert.match(html,/START/);
  assert.match(html,/MIDDLE/);
  assert.doesNotMatch(html,/AFTER/);
  assert.match(html,/name="from" value="2026-01-01"/);
  assert.match(html,/name="to" value="2026-01-02"/);
  html=await (await fetch(base+'?from=2026-01-01&to=2026-01-02')).text();
  assert.match(html,/from=2026-01-01&amp;to=2026-01-02&amp;page=2/);
  for(const query of ['?type=invalid','?outcome=invalid','?page=0','?search=a&search=b',
    '?from=2026-02-30','?to=2026-01-01','?from=2026-01-02&to=2026-01-01']){
    assert.equal((await fetch(base+query)).status,400);
  }
});
