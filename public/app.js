(()=>{'use strict';
const tabLinks=[...document.querySelectorAll('[data-tab-target]')];
const tabButtons=tabLinks.filter(link=>link.getAttribute('role')==='tab');
const tabPanels=[...document.querySelectorAll('.dashboard-tabpanel')];
const defaultTab=document.querySelector('[data-default-tab]')?.dataset.defaultTab||'trading';
function activateTab(id){
  if(!tabPanels.some(panel=>panel.id===id))id=defaultTab;
  tabPanels.forEach(panel=>{
    const active=panel.id===id;
    panel.hidden=!active;
    panel.classList.toggle('active',active);
  });
  tabButtons.forEach(button=>{
    const active=button.dataset.tabTarget===id;
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
  });
}
function tabFromHash(){
  const hash=window.location.hash.slice(1);
  activateTab(hash==='trade'?'trading':hash);
}
tabLinks.forEach(button=>button.addEventListener('click',event=>{
  event.preventDefault();
  activateTab(button.dataset.tabTarget);
  if(window.location.hash!==button.hash)window.history.pushState(null,'',button.hash);
}));
const worldClocks=[...document.querySelectorAll('[data-world-clock]')];
if(worldClocks.length){
  const updateWorldClocks=()=>{
    const now=new Date();
    worldClocks.forEach(clock=>{
      const timezone=clock.dataset.timezone;
      clock.querySelector('.world-clock-time').textContent=new Intl.DateTimeFormat('en-GB',{
        timeZone:timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
      }).format(now);
      clock.querySelector('.world-clock-date').textContent=new Intl.DateTimeFormat('en-GB',{
        timeZone:timezone,weekday:'short',day:'numeric',month:'short',timeZoneName:'short'
      }).format(now);
    });
  };
  updateWorldClocks();
  setInterval(updateWorldClocks,1000);
}
document.querySelectorAll('[data-record-outcome]').forEach(button=>button.addEventListener('click',event=>{
  event.preventDefault();
  const journal=document.getElementById('journal');
  const outcome=document.getElementById('journalOutcome');
  if(!journal||!outcome)return;
  outcome.value=button.dataset.recordOutcome;
  activateTab('journal');
  if(window.location.hash!=='#journal')window.history.pushState(null,'','#journal');
  document.getElementById('journalTradeForm')?.scrollIntoView({behavior:'smooth',block:'start'});
  outcome.focus({preventScroll:true});
}));
window.addEventListener('hashchange',tabFromHash);
window.addEventListener('popstate',tabFromHash);
tabFromHash();

const countdowns=[...document.querySelectorAll('[data-until]')];
if(countdowns.length){
  const tick=()=>{
    countdowns.forEach(timer=>{
      const until=Date.parse(timer.dataset.until||'');
      const seconds=Number.isFinite(until)?Math.max(0,Math.ceil((until-Date.now())/1000)):0;
      const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),remainingSeconds=seconds%60;
      timer.textContent=`${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(remainingSeconds).padStart(2,'0')}s`;
      timer.setAttribute('aria-label',`${days} days, ${hours} hours, ${minutes} minutes, ${remainingSeconds} seconds until trading is available`);
      timer.classList.toggle('counting',seconds>0);
    });
  };
  tick();
  setInterval(tick,1000);
}

const nySessionTimer=document.getElementById('nySessionTimer');
if(nySessionTimer){
  const schedule=JSON.parse(decodeURIComponent(nySessionTimer.dataset.schedule));
  const accountTimezone=nySessionTimer.dataset.accountTimezone||'Europe/Sofia';
  const phase=document.getElementById('nySessionPhase');
  const milestone=document.getElementById('nySessionMilestone');
  const target=document.getElementById('nySessionTarget');
  const panel=document.getElementById('nySessionPanel');
  const badge=document.getElementById('nySessionBadge');
  const liveBanner=document.getElementById('nyLiveBanner');
  const liveLabel=document.getElementById('nyLiveLabel');
  const liveCountdown=document.getElementById('nyLiveCountdown');
  const clockText=ms=>{const total=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(total/3600)}h ${String(Math.floor(total%3600/60)).padStart(2,'0')}m ${String(total%60).padStart(2,'0')}s`};
  const formatTarget=date=>{
    const format=timeZone=>new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(date);
    if(accountTimezone==='Europe/Sofia')return[
      {label:'New York',value:format('America/New_York')},
      {label:'Your time + Bulgaria · Europe/Sofia',value:format('Europe/Sofia')}
    ];
    return[
      {label:`Your time · ${accountTimezone}`,value:format(accountTimezone)},
      {label:'New York',value:format('America/New_York')},
      {label:'Bulgaria',value:format('Europe/Sofia')}
    ];
  };
  const tickNySession=()=>{
    const now=Date.now();
    const nextEventIndex=schedule.findIndex(event=>Date.parse(event.at)>now);
    const nextEvent=schedule[nextEventIndex];
    const nextPremarket=schedule.find(event=>event.type==='premarket'&&Date.parse(event.at)>now);
    if(!nextPremarket){
      nySessionTimer.textContent='Schedule unavailable';
      phase.textContent='REFRESH FOR UPCOMING PRE-MARKET';
      target.textContent='';
      return;
    }
    const remaining=Math.max(0,Math.ceil((Date.parse(nextPremarket.at)-now)/1000));
    const days=Math.floor(remaining/86400),hours=Math.floor(remaining%86400/3600),minutes=Math.floor(remaining%3600/60),seconds=remaining%60;
    nySessionTimer.textContent=`${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s`;
    const live=nextEvent?.type==='open'?'premarket':nextEvent?.type==='close'?'regular':'';
    if(live==='premarket'){
      phase.textContent='PRE-MARKET IS OPEN · NY OPEN AT 9:30 AM ET';
    }else if(live==='regular'){
      phase.textContent='REGULAR NY SESSION · CLOSES AT 4:00 PM ET';
    }else{
      phase.textContent='WAITING FOR PRE-MARKET';
    }
    panel.classList.toggle('is-premarket',live==='premarket');
    panel.classList.toggle('is-regular',live==='regular');
    badge.textContent=live==='premarket'?'PRE-MARKET OPEN':live==='regular'?'NY SESSION OPEN':'US EQUITIES · EASTERN TIME';
    liveBanner.hidden=!live;
    if(live){
      liveLabel.textContent=live==='premarket'?'PRE-MARKET OPEN':'NY SESSION OPEN';
      liveCountdown.textContent=`${live==='premarket'?'NY OPEN IN':'CLOSES IN'} ${clockText(Date.parse(nextEvent.at)-now)}`;
    }
    milestone.textContent='NEXT PRE-MARKET · 8:30 AM ET';
    target.replaceChildren();
    formatTarget(new Date(nextPremarket.at)).forEach(({label,value})=>{
      const row=document.createElement('span');
      row.className='session-time-row';
      const name=document.createElement('strong');
      name.textContent=`${label}: `;
      row.append(name,document.createTextNode(value));
      target.append(row);
    });
  };
  tickNySession();
  setInterval(tickNySession,1000);
}

const fxSessionGrid=document.getElementById('fxSessionGrid');
if(fxSessionGrid){
  const sessions=[
    {id:'sydney',timezone:'Australia/Sydney',open:8,close:17},
    {id:'tokyo',timezone:'Asia/Tokyo',open:9,close:18},
    {id:'london',timezone:'Europe/London',open:8,close:17},
    {id:'new-york',timezone:'America/New_York',open:8,close:17}
  ];
  const partsAt=(date,timezone)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:timezone,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'short'
  }).formatToParts(date).map(part=>[part.type,part.value]));
  const toSessionTime=(dateParts,hour,timezone)=>{
    const target=Date.UTC(Number(dateParts.year),Number(dateParts.month)-1,Number(dateParts.day),hour);
    let timestamp=target;
    for(let i=0;i<3;i++){
      const actual=partsAt(new Date(timestamp),timezone);
      const actualAsUtc=Date.UTC(Number(actual.year),Number(actual.month)-1,Number(actual.day),Number(actual.hour),Number(actual.minute),Number(actual.second));
      timestamp+=target-actualAsUtc;
    }
    return new Date(timestamp);
  };
  const formatSofiaTime=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Sofia',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  const tickFxSessions=()=>{
    const now=new Date();
    let activeCount=0;
    sessions.forEach(session=>{
      const local=partsAt(now,session.timezone);
      const minuteOfDay=Number(local.hour)*60+Number(local.minute);
      const openMinute=session.open*60,closeMinute=session.close*60;
      const weekday=['Mon','Tue','Wed','Thu','Fri'].includes(local.weekday);
      const active=weekday&&minuteOfDay>=openMinute&&minuteOfDay<closeMinute;
      const card=fxSessionGrid.querySelector(`[data-session="${session.id}"]`);
      const state=card.querySelector('.fx-session-state');
      const progress=card.querySelector('.fx-session-progress span');
      const openTime=formatSofiaTime.format(toSessionTime(local,session.open,session.timezone));
      const closeTime=formatSofiaTime.format(toSessionTime(local,session.close,session.timezone));
      let nextOpen=toSessionTime(local,session.open,session.timezone);
      let openingDay=new Date(Date.UTC(Number(local.year),Number(local.month)-1,Number(local.day)));
      while(nextOpen<=now||openingDay.getUTCDay()===0||openingDay.getUTCDay()===6){
        openingDay.setUTCDate(openingDay.getUTCDate()+1);
        nextOpen=toSessionTime({
          year:openingDay.getUTCFullYear(),month:openingDay.getUTCMonth()+1,day:openingDay.getUTCDate()
        },session.open,session.timezone);
      }
      const countdown=card.querySelector('.fx-session-countdown');
      const countdownTarget=active?toSessionTime(local,session.close,session.timezone):nextOpen;
      const seconds=Math.max(0,Math.ceil((countdownTarget-now)/1000));
      const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),remainingSeconds=seconds%60;
      countdown.textContent=`${active?'CLOSES IN':'OPENS IN'} ${days?`${days}d `:''}${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(remainingSeconds).padStart(2,'0')}s`;
      countdown.title=`${active?'Closing':'Next opening'}: ${formatSofiaTime.format(countdownTarget)} Sofia time`;
      card.classList.toggle('is-active',active);
      card.setAttribute('aria-label',`${session.id==='new-york'?'New York':session.id} session ${active?'is active':'is closed'}, opens at ${openTime} and closes at ${closeTime} Sofia time`);
      state.textContent=active?'ACTIVE':'CLOSED';
      card.querySelector('.fx-session-open').textContent=openTime;
      card.querySelector('.fx-session-close').textContent=closeTime;
      progress.style.width=active?`${Math.min(100,((minuteOfDay-openMinute)/((session.close-session.open)*60))*100)}%`:'0%';
      if(active)activeCount++;
    });
    const summary=document.getElementById('fxSessionSummary');
    const activeStatus=activeCount===0?'NO MAJOR SESSION ACTIVE':activeCount===1?'1 SESSION ACTIVE':`${activeCount} SESSIONS ACTIVE · OVERLAP`;
    summary.textContent=`SOFIA TIME · ${activeStatus}`;
    summary.classList.toggle('tag-green',activeCount>0);
  };
  tickFxSessions();
  setInterval(tickFxSessions,1000);
}

const ruleDialog=document.getElementById('ruleDialog');
const ruleEditor=document.getElementById('ruleEditor');
const ruleDeleteForm=document.getElementById('ruleDeleteForm');
if(ruleDialog&&ruleEditor){
  const title=document.getElementById('ruleDialogTitle');
  const name=document.getElementById('ruleTitle');
  const description=document.getElementById('ruleDescription');
  const active=document.getElementById('ruleActive');
  document.getElementById('addRuleBtn')?.addEventListener('click',()=>{
    title.textContent='ADD NEW RULE';
    ruleEditor.action='/rules';
    ruleEditor.reset();
    active.checked=true;
    ruleDeleteForm.hidden=true;
    ruleDialog.showModal();
    name.focus();
  });
  document.querySelectorAll('.rule-edit-trigger').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.id;
    title.textContent='EDIT RULE';
    ruleEditor.action='/rules/'+encodeURIComponent(id)+'/edit';
    ruleDeleteForm.action='/rules/'+encodeURIComponent(id)+'/delete';
    name.value=button.dataset.title||'';
    description.value=button.dataset.description||'';
    active.checked=button.dataset.active==='true';
    ruleDeleteForm.hidden=false;
    ruleDialog.showModal();
    name.focus();
  }));
  ruleDialog.addEventListener('click',event=>{if(event.target===ruleDialog)ruleDialog.close()});
}

const dataElement=document.getElementById('trade-data');
if(!dataElement)return;
const trades=JSON.parse(dataElement.textContent);
function updatePlanDeviation(form){
  const followedPlan=form.querySelector('[name="followedPlan"]');
  const field=form.querySelector('[data-plan-deviation]');
  const reason=field?.querySelector('[name="planDeviationReason"]');
  if(!followedPlan||!field||!reason)return;
  field.hidden=followedPlan.checked;
  reason.required=!followedPlan.checked;
}
document.querySelectorAll('[data-plan-follow-up]').forEach(form=>{
  form.querySelector('[name="followedPlan"]')?.addEventListener('change',()=>updatePlanDeviation(form));
  updatePlanDeviation(form);
});
document.querySelectorAll('form[data-confirm]').forEach(form=>{
  form.addEventListener('submit',event=>{
    if(!window.confirm(form.dataset.confirm))event.preventDefault();
  });
});
const tradeDialog=document.getElementById('tradeDialog');
const tradeEditor=document.getElementById('tradeEditor');
const tradesById=new Map(trades.map(trade=>[trade.id,trade]));
const imageDialog=document.getElementById('imagePreviewDialog');
const fullImage=document.getElementById('imagePreviewFull');
const imagePreviewStatus=document.getElementById('imagePreviewStatus');
fullImage.addEventListener('load',()=>{
  imagePreviewStatus.hidden=true;
  fullImage.hidden=false;
});
fullImage.addEventListener('error',()=>{
  imagePreviewStatus.textContent='Could not load this image. Close the preview and try again.';
  imagePreviewStatus.hidden=false;
});
function bindImagePreview(button){
  button.addEventListener('click',()=>{
    imagePreviewStatus.textContent='Loading image preview…';
    imagePreviewStatus.hidden=false;
    fullImage.hidden=true;
    fullImage.src=button.dataset.imageSrc;
    imageDialog.showModal();
    if(fullImage.complete){
      if(fullImage.naturalWidth)fullImage.dispatchEvent(new Event('load'));
      else fullImage.dispatchEvent(new Event('error'));
    }
  });
}
document.querySelectorAll('.image-preview-trigger').forEach(bindImagePreview);
document.querySelectorAll('[data-image-upload]').forEach(form=>{
  const input=form.querySelector('[data-image-input]');
  const preview=form.querySelector('[data-upload-preview]');
  const error=form.querySelector('.upload-error');
  input.addEventListener('change',()=>{
    preview.replaceChildren();
    preview.hidden=true;
    error.hidden=true;
    const file=input.files[0];
    if(!file)return;
    if(file.size>5*1024*1024){
      input.value='';
      error.textContent='Images must be 5 MB or smaller.';
      error.hidden=false;
      return;
    }
    const objectUrl=URL.createObjectURL(file);
    const button=document.createElement('button');
    button.type='button';
    button.className='image-preview-trigger';
    button.dataset.imageSrc=objectUrl;
    button.setAttribute('aria-label','Preview selected trade image');
    const image=document.createElement('img');
    image.src=objectUrl;
    image.alt='Selected trade image thumbnail';
    button.append(image);
    bindImagePreview(button);
    preview.append(button);
    preview.hidden=false;
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    error.hidden=true;
    const submit=form.querySelector('[type="submit"]');
    submit.disabled=true;
    try{
      const response=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{'X-CSRF-Token':form.querySelector('[name="_csrf"]').value}});
      if(!response.ok){
        error.textContent=await response.text()||'Could not save this trade image.';
        error.hidden=false;
        return;
      }
      window.location.assign(response.url);
    }catch(cause){
      error.textContent='Unable to upload the image. Check your connection and try again.';
      error.hidden=false;
    }finally{
      submit.disabled=false;
    }
  });
});
const tradeFields={
  account:document.getElementById('tradeAccount'),
  session:document.getElementById('tradeSession'),
  instrument:document.getElementById('tradeInstrument'),
  side:document.getElementById('tradeSide'),
  outcome:document.getElementById('tradeOutcome'),
  pnl:document.getElementById('tradePnl'),
  currency:document.getElementById('tradeCurrency'),
  strategy:document.getElementById('tradeStrategy'),
  emotion:document.getElementById('tradeEmotion'),
  followedPlan:document.getElementById('tradeFollowedPlan'),
  planDeviationReason:document.getElementById('tradePlanDeviationReason'),
  notes:document.getElementById('tradeNotes')
};
function editTrade(id){
  const trade=tradesById.get(id);
  if(!trade)throw new Error(`Trade record ${id} is not available for editing.`);
  tradeEditor.action='/trades/'+encodeURIComponent(id)+'/edit';
  tradeFields.account.value=trade.account||'';
  tradeFields.session.value=trade.session||'';
  tradeFields.instrument.value=trade.instrument||'';
  tradeFields.side.value=trade.side||'';
  tradeFields.outcome.value=trade.outcome;
  tradeFields.pnl.value=Number(trade.pnl||0).toFixed(2);
  tradeFields.currency.value=trade.currency||'USD';
  tradeFields.strategy.value=trade.strategy||'';
  tradeFields.emotion.value=trade.emotion||'calm';
  tradeFields.followedPlan.checked=trade.followedPlan!==false;
  tradeFields.planDeviationReason.value=trade.planDeviationReason||'';
  updatePlanDeviation(tradeEditor);
  tradeFields.notes.value=trade.notes||'';
  document.getElementById('tradeChecklistStatus').textContent=trade.checklistCompleted===true?
    'Checklist was completed when this trade was recorded.':
    trade.checklistCompleted===false?'Checklist was not completed when this trade was recorded.':'Checklist status was not recorded for this older trade.';
  const existingImage=document.getElementById('tradeExistingImage'),removeImageLabel=document.getElementById('removeTradeImageLabel'),removeImage=document.getElementById('removeTradeImage');
  existingImage.replaceChildren();
  removeImage.checked=false;
  removeImageLabel.hidden=!trade.hasImage;
  if(trade.hasImage){
    const preview=document.createElement('button');
    preview.type='button';
    preview.className='image-preview-trigger';
    preview.dataset.imageSrc=`/trades/${encodeURIComponent(id)}/image`;
    preview.setAttribute('aria-label','Preview current trade image');
    const image=document.createElement('img');
    image.src=preview.dataset.imageSrc;
    image.alt='Current trade attachment';
    preview.append(image);
    bindImagePreview(preview);
    existingImage.append(preview);
  }
  const uploadPreview=tradeEditor.querySelector('[data-upload-preview]');
  uploadPreview.replaceChildren();
  uploadPreview.hidden=true;
  tradeEditor.querySelector('[data-image-input]').value='';
  tradeEditor.querySelector('.upload-error').hidden=true;
  document.getElementById('tradeEditDate').textContent=`TRADE DATE · ${trade.date}`;
  tradeDialog.showModal();
  tradeFields.instrument.focus();
}
document.querySelectorAll('.trade-edit-trigger').forEach(button=>button.addEventListener('click',()=>editTrade(button.dataset.tradeId)));
tradeDialog.addEventListener('click',event=>{if(event.target===tradeDialog)tradeDialog.close()});
imageDialog.addEventListener('click',event=>{if(event.target===imageDialog)imageDialog.close()});
tradeFields.currency.addEventListener('input',()=>{tradeFields.currency.value=tradeFields.currency.value.toUpperCase()});
document.getElementById('removeTradeImage').addEventListener('change',event=>{
  document.getElementById('tradeExistingImage').hidden=event.target.checked;
});

const grid=document.getElementById('calendarGrid');
const calendarTimezone=grid.dataset.timezone||'Europe/Sofia';
const calendarToday=grid.dataset.today||new Intl.DateTimeFormat('en-CA',{
  timeZone:calendarTimezone,year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
const [calendarYear,calendarMonth]=calendarToday.split('-').map(Number);
const current=new Date(calendarYear,calendarMonth-1,1);
const title=document.getElementById('monthTitle');
const monthPnl=document.getElementById('monthPnl');
const selected=document.getElementById('selectedDay');
const calendarCurrency=document.getElementById('calendarCurrency');
const defaultCalendarCurrency=grid.dataset.defaultCurrency||'USD';
const calendarCurrencies=[...new Set([defaultCalendarCurrency,...trades.map(trade=>trade.currency||'USD')])].sort();
calendarCurrencies.forEach(currency=>{
  const option=document.createElement('option');
  option.value=currency;
  option.textContent=currency;
  calendarCurrency.append(option);
});
let selectedCalendarCurrency=defaultCalendarCurrency;
calendarCurrency.value=selectedCalendarCurrency;
let selectedCalendarDate='';
const analysisRangeButtons=[...document.querySelectorAll('[data-analysis-range]')];
const analysisPeriodLabel=document.getElementById('analysisPeriodLabel');
const analysisTradeCount=document.getElementById('analysisTradeCount');
const analysisWinRate=document.getElementById('analysisWinRate');
const analysisPlanRate=document.getElementById('analysisPlanRate');
const analysisNetPnl=document.getElementById('analysisNetPnl');
const analysisCurrency=document.getElementById('analysisCurrency');
const equityChart=document.getElementById('equityChart');
const equityChartCaption=document.getElementById('equityChartCaption');
const equityChartEmpty=document.getElementById('equityChartEmpty');
const outcomeBreakdown=document.getElementById('outcomeBreakdown');
const dailyBars=document.getElementById('dailyBars');
const dailyAnalysisCaption=document.getElementById('dailyAnalysisCaption');
let analysisRange=grid.dataset.analysisRange||'month';
let selectedAnalysisCurrency=defaultCalendarCurrency;
const currencyTotals=items=>items.reduce((totals,trade)=>{
  const currency=trade.currency||'USD';
  totals.set(currency,(totals.get(currency)||0)+Number(trade.pnl||0));
  return totals;
},new Map());
const formatTotals=totals=>[...totals].sort(([a],[b])=>a.localeCompare(b))
  .map(([currency,value])=>`${currency} ${value>0?'+':''}${value.toFixed(2)}`).join(' · ');
const formatPnl=(value,currency)=>`${currency} ${Number(value||0)>0?'+':''}${Number(value||0).toFixed(2)}`;
function getAnalysisTrades(){
  const year=current.getFullYear(),month=String(current.getMonth()+1).padStart(2,'0');
  if(analysisRange==='month'){
    const prefix=`${year}-${month}`;
    return trades.filter(trade=>trade.date.startsWith(prefix));
  }
  if(analysisRange==='all')return trades.slice();
  const todayOrdinal=Date.parse(`${calendarToday}T00:00:00Z`);
  const rangeDays=analysisRange==='7d'?7:30;
  const startOrdinal=todayOrdinal-(rangeDays-1)*86400000;
  return trades.filter(trade=>{
    const ordinal=Date.parse(`${trade.date}T00:00:00Z`);
    return ordinal>=startOrdinal&&ordinal<=todayOrdinal;
  });
}
function appendSvg(tag,attributes={},text=''){
  const element=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attributes).forEach(([name,value])=>element.setAttribute(name,String(value)));
  if(text)element.textContent=text;
  equityChart.append(element);
  return element;
}
function renderEquityChart(items,currency){
  equityChart.replaceChildren();
  if(!items.length||!currency){
    equityChart.hidden=true;
    equityChartEmpty.hidden=false;
    equityChartCaption.textContent=currency?'No trades in this period.':'No currency data for this period.';
    return;
  }
  equityChart.hidden=false;
  equityChartEmpty.hidden=true;
  const ordered=items.filter(trade=>(trade.currency||'USD')===currency)
    .slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  if(!ordered.length){
    equityChart.hidden=true;
    equityChartEmpty.hidden=false;
    equityChartCaption.textContent='No trades in this currency for this period.';
    return;
  }
  let running=0;
  const points=[{date:ordered[0].date,value:0}];
  ordered.forEach(trade=>{
    running+=Number(trade.pnl||0);
    points.push({date:trade.date,value:running});
  });
  const values=points.map(point=>point.value);
  let min=Math.min(0,...values),max=Math.max(0,...values);
  if(min===max){min-=1;max+=1}
  const padding=(max-min)*.12;
  min-=padding;
  max+=padding;
  const left=54,right=744,top=18,bottom=192;
  const x=index=>left+(points.length===1?0:index/(points.length-1))*(right-left);
  const y=value=>bottom-(value-min)/(max-min)*(bottom-top);
  for(let index=0;index<=4;index++){
    const value=max-(max-min)*index/4;
    const position=y(value);
    appendSvg('line',{x1:left,y1:position,x2:right,y2:position,class:'chart-gridline'});
    appendSvg('text',{x:left-8,y:position+4,'text-anchor':'end',class:'chart-axis-label'},value.toFixed(2));
  }
  const zeroY=y(0);
  appendSvg('line',{x1:left,y1:zeroY,x2:right,y2:zeroY,class:'chart-zero-line'});
  const coordinates=points.map((point,index)=>`${x(index)},${y(point.value)}`).join(' ');
  const area=`${left},${zeroY} ${coordinates} ${right},${zeroY}`;
  appendSvg('polygon',{points:area,class:'chart-area'});
  appendSvg('polyline',{points:coordinates,class:'chart-line'});
  const pointIndices=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])];
  pointIndices.forEach(index=>{
    const point=points[index];
    appendSvg('circle',{cx:x(index),cy:y(point.value),r:3,class:'chart-point'});
  });
  if(points[0].date===points[points.length-1].date){
    appendSvg('text',{x:(left+right)/2,y:222,'text-anchor':'middle',class:'chart-axis-label'},points[0].date.slice(5));
  }else{
    appendSvg('text',{x:left,y:222,class:'chart-axis-label'},points[0].date.slice(5));
    appendSvg('text',{x:right,y:222,'text-anchor':'end',class:'chart-axis-label'},points[points.length-1].date.slice(5));
  }
  equityChart.setAttribute('aria-label',`${currency} cumulative profit and loss. Final result ${formatPnl(running,currency)} across ${ordered.length} trades.`);
  equityChartCaption.textContent=`${currency} · ${ordered.length} trades · final ${formatPnl(running,currency)}`;
}
function calculatePerformanceStats(items){
  const ordered=items.slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const months=new Map(),days=new Map();
  let net=0,grossProfit=0,grossLoss=0,positiveCount=0,negativeCount=0;
  let peak=0,maxDrawdown=0,bestTrade=null,worstTrade=null;
  ordered.forEach(trade=>{
    const pnl=Number(trade.pnl||0);
    net+=pnl;
    if(pnl>0){grossProfit+=pnl;positiveCount++}
    if(pnl<0){grossLoss-=pnl;negativeCount++}
    peak=Math.max(peak,net);
    maxDrawdown=Math.max(maxDrawdown,peak-net);
    if(!bestTrade||pnl>Number(bestTrade.pnl))bestTrade=trade;
    if(!worstTrade||pnl<Number(worstTrade.pnl))worstTrade=trade;
    const month=trade.date.slice(0,7);
    months.set(month,(months.get(month)||0)+pnl);
    days.set(trade.date,(days.get(trade.date)||0)+pnl);
  });
  const monthResults=[...months].map(([date,pnl])=>({date,pnl}));
  const wins=ordered.filter(trade=>trade.outcome==='WIN').length;
  const losses=ordered.filter(trade=>trade.outcome==='LOSS').length;
  return{
    count:ordered.length,net,
    averageMonth:months.size?net/months.size:null,
    averageTrade:ordered.length?net/ordered.length:null,
    recordedMonths:months.size,profitableMonths:monthResults.filter(month=>month.pnl>0).length,
    wins,decisiveTrades:wins+losses,winRate:wins+losses?wins/(wins+losses)*100:null,
    recordedDays:days.size,profitableDays:[...days.values()].filter(pnl=>pnl>0).length,
    averageWin:positiveCount?grossProfit/positiveCount:null,
    averageLoss:negativeCount?-grossLoss/negativeCount:null,
    maxDrawdown:ordered.length?maxDrawdown:null,
    profitFactor:grossLoss?grossProfit/grossLoss:grossProfit?Infinity:null,
    bestTrade,worstTrade,
    bestMonth:monthResults.reduce((best,month)=>!best||month.pnl>best.pnl?month:best,null),
    worstMonth:monthResults.reduce((worst,month)=>!worst||month.pnl<worst.pnl?month:worst,null)
  };
}
function renderPerformanceStats(items,currency){
  const container=document.getElementById('performanceStats');
  container.replaceChildren();
  const stats=calculatePerformanceStats(items.filter(trade=>(trade.currency||'USD')===currency));
  const money=value=>value===null?'—':formatPnl(value,currency);
  const tradeDetail=trade=>trade?`${trade.date} · ${trade.instrument||'Trade'}`:'No trades in this period';
  const groups=[
    {label:'MONEY',metrics:[
      ['NET PROFIT',stats.count?money(stats.net):'—','Realized journal P&L',stats.net],
      ['AVERAGE PER MONTH',money(stats.averageMonth),`${stats.profitableMonths} of ${stats.recordedMonths} recorded months profitable`,stats.averageMonth],
      ['AVERAGE PER TRADE',money(stats.averageTrade),'Net result after journaled losses',stats.averageTrade],
      ['CURRENT BALANCE','—','Unavailable: account balance is not tracked'],
      ['DEPOSITS','—','Unavailable: deposits are not tracked'],
      ['WITHDRAWALS','—','Unavailable: withdrawals are not tracked']
    ]},
    {label:'TRADES',metrics:[
      ['TRADES',String(stats.count),'In the selected currency and period'],
      ['WIN RATE',stats.winRate===null?'—':`${stats.winRate.toFixed(1)}%`,`${stats.wins} wins / ${stats.decisiveTrades} decided trades`],
      ['PROFITABLE DAYS',`${stats.profitableDays} of ${stats.recordedDays}`,'Days with positive net P&L'],
      ['AVERAGE WIN',money(stats.averageWin),'Trades with positive P&L',stats.averageWin],
      ['AVERAGE LOSS',money(stats.averageLoss),'Trades with negative P&L',stats.averageLoss],
      ['AVERAGE TRADE DURATION','—','Unavailable: entry and exit times are not tracked']
    ]},
    {label:'RISK & RESULTS',metrics:[
      ['MAX DRAWDOWN',money(stats.maxDrawdown),'Peak-to-trough cumulative journal P&L; not equity drawdown %'],
      ['PROFIT FACTOR',stats.profitFactor===null?'—':stats.profitFactor===Infinity?'∞':stats.profitFactor.toFixed(2),stats.profitFactor===Infinity?'Positive P&L with no losing trades':'Gross positive P&L / absolute gross negative P&L'],
      ['BEST TRADE',stats.bestTrade?money(Number(stats.bestTrade.pnl)):'—',tradeDetail(stats.bestTrade),stats.bestTrade?Number(stats.bestTrade.pnl):null],
      ['WORST TRADE',stats.worstTrade?money(Number(stats.worstTrade.pnl)):'—',tradeDetail(stats.worstTrade),stats.worstTrade?Number(stats.worstTrade.pnl):null],
      ['BEST MONTH',stats.bestMonth?money(stats.bestMonth.pnl):'—',stats.bestMonth?.date||'No recorded months',stats.bestMonth?.pnl],
      ['WORST MONTH',stats.worstMonth?money(stats.worstMonth.pnl):'—',stats.worstMonth?.date||'No recorded months',stats.worstMonth?.pnl]
    ]}
  ];
  groups.forEach(group=>{
    const section=document.createElement('section');
    section.className='performance-stat-group';
    const heading=document.createElement('h3');
    heading.textContent=group.label;
    const cells=document.createElement('div');
    cells.className='performance-stat-grid';
    group.metrics.forEach(([label,value,detail,tone])=>{
      const card=document.createElement('article');
      card.className='performance-stat';
      const name=document.createElement('h4');
      name.textContent=label;
      const result=document.createElement('strong');
      result.textContent=value;
      if(tone>0)result.classList.add('green');
      if(tone<0)result.classList.add('red');
      const caption=document.createElement('p');
      caption.textContent=detail;
      card.append(name,result,caption);
      cells.append(card);
    });
    section.append(heading,cells);
    container.append(section);
  });
  document.getElementById('performanceStatsCaption').textContent=currency?
    `${currency} · ${analysisPeriodLabel.textContent} · journal records only`:'No trades in this period';
}
function renderAnalysis(){
  const items=getAnalysisTrades();
  const currencies=[...currencyTotals(items).keys()].sort();
  if(!currencies.includes(selectedAnalysisCurrency))selectedAnalysisCurrency=currencies[0]||'';
  analysisCurrency.replaceChildren();
  currencies.forEach(currency=>{
    const option=document.createElement('option');
    option.value=currency;
    option.textContent=currency;
    analysisCurrency.append(option);
  });
  analysisCurrency.disabled=currencies.length===0;
  analysisCurrency.value=selectedAnalysisCurrency;
  const wins=items.filter(trade=>trade.outcome==='WIN').length;
  const losses=items.filter(trade=>trade.outcome==='LOSS').length;
  const breakeven=items.filter(trade=>trade.outcome==='BREAKEVEN').length;
  const followed=items.filter(trade=>trade.followedPlan===true).length;
  const chronological=items.slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  let currentType='',currentLength=0,bestWin=0,worstLoss=0;
  chronological.forEach(trade=>{
    if(trade.outcome===currentType)currentLength++;
    else{
      currentType=trade.outcome;
      currentLength=1;
    }
    if(currentType==='WIN')bestWin=Math.max(bestWin,currentLength);
    if(currentType==='LOSS')worstLoss=Math.max(worstLoss,currentLength);
  });
  document.getElementById('currentWinStreak').textContent=String(currentType==='WIN'?currentLength:0);
  document.getElementById('currentLossStreak').textContent=String(currentType==='LOSS'?currentLength:0);
  document.getElementById('bestWinStreak').textContent=String(bestWin);
  document.getElementById('worstLossStreak').textContent=String(worstLoss);
  analysisTradeCount.textContent=String(items.length);
  const decisiveTrades=wins+losses;
  analysisWinRate.textContent=decisiveTrades?`${Math.round(wins/decisiveTrades*100)}%`:'—';
  analysisPlanRate.textContent=items.length?`${Math.round(followed/items.length*100)}%`:'—';
  analysisNetPnl.replaceChildren();
  const totals=currencyTotals(items);
  if(!totals.size){
    const empty=document.createElement('span');
    empty.className='analysis-no-data';
    empty.textContent='No trades';
    analysisNetPnl.append(empty);
  }else{
    [...totals].sort(([a],[b])=>a.localeCompare(b)).forEach(([currency,value])=>{
      const row=document.createElement('span');
      row.className='analysis-net-row';
      row.textContent=formatPnl(value,currency);
      if(value>0)row.classList.add('green');
      if(value<0)row.classList.add('red');
      analysisNetPnl.append(row);
    });
  }
  const rangeLabel=analysisRange==='month'?title.textContent:
    analysisRange==='7d'?'Last 7 days':analysisRange==='30d'?'Last 30 days':'All recorded trades';
  analysisPeriodLabel.textContent=rangeLabel;
  analysisRangeButtons.forEach(button=>{
    const active=button.dataset.analysisRange===analysisRange;
    button.classList.toggle('is-selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
  renderPerformanceStats(items,selectedAnalysisCurrency);
  renderEquityChart(items,selectedAnalysisCurrency);
  const outcomes=[
    {label:'WINS',count:wins,className:'win'},
    {label:'LOSSES',count:losses,className:'loss'},
    {label:'BREAK-EVEN',count:breakeven,className:'breakeven'}
  ];
  outcomeBreakdown.replaceChildren();
  outcomes.forEach(outcome=>{
    const row=document.createElement('div');
    row.className=`analysis-outcome-row analysis-outcome-${outcome.className}`;
    const label=document.createElement('span');
    label.textContent=outcome.label;
    const track=document.createElement('span');
    track.className='outcome-track';
    const fill=document.createElement('span');
    fill.style.width=items.length?`${outcome.count/items.length*100}%`:'0%';
    track.append(fill);
    const count=document.createElement('strong');
    count.textContent=String(outcome.count);
    row.append(label,track,count);
    outcomeBreakdown.append(row);
  });
  dailyBars.replaceChildren();
  const dailyTotals=new Map();
  items.forEach(trade=>{
    const currency=trade.currency||'USD';
    const day=dailyTotals.get(trade.date)||new Map();
    day.set(currency,(day.get(currency)||0)+Number(trade.pnl||0));
    dailyTotals.set(trade.date,day);
  });
  const daily=[...dailyTotals].sort(([a],[b])=>a.localeCompare(b));
  const maxDaily=Math.max(0,...daily.map(([,day])=>Math.abs(day.get(selectedAnalysisCurrency)||0)));
  daily.forEach(([date,day])=>{
    const value=day.get(selectedAnalysisCurrency)||0;
    const bar=document.createElement('span');
    bar.className=`daily-bar ${value>0?'positive':value<0?'negative':'neutral'}`;
    bar.setAttribute('role','listitem');
    bar.setAttribute('aria-label',`${date}: ${formatPnl(value,selectedAnalysisCurrency||'USD')}`);
    bar.title=`${date} · ${formatPnl(value,selectedAnalysisCurrency||'USD')}`;
    bar.style.height=`${maxDaily?Math.max(4,Math.abs(value)/maxDaily*48):4}%`;
    dailyBars.append(bar);
  });
  dailyAnalysisCaption.textContent=selectedAnalysisCurrency?
    `${selectedAnalysisCurrency} daily net result · ${daily.length} active trading days`:
    'Daily net result in selected currency.';
}
function showDay(date,items){
  selectedCalendarDate=date;
  grid.querySelectorAll('.day').forEach(button=>{
    const active=button.dataset.date===date;
    button.classList.toggle('is-selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
  selected.replaceChildren();
  const make=(tag,className,text)=>{
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=text;
    return element;
  };
  const header=make('div','day-records-header');
  const titleWrap=make('div','day-records-title');
  const [y,m,d]=date.split('-').map(Number);
  titleWrap.append(
    make('span','day-records-kicker','RECORDS'),
    make('h3','',new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d))))
  );
  header.append(titleWrap);
  selected.append(header);
  if(!items.length){
    selected.append(make('p','day-records-empty','No trades on this date.'));
    return;
  }
  const wins=items.filter(trade=>trade.outcome==='WIN').length;
  const losses=items.filter(trade=>trade.outcome==='LOSS').length;
  const breakeven=items.length-wins-losses;
  const followed=items.filter(trade=>trade.followedPlan!==false).length;
  const totals=currencyTotals(items);
  const net=[...totals.values()].reduce((sum,value)=>sum+value,0);
  const stats=make('div','day-records-stats');
  const stat=(label,value,tone)=>{
    const box=make('div','day-records-stat');
    const strong=make('strong',tone||'',value);
    box.append(make('span','',label),strong);
    stats.append(box);
  };
  stat('Trades',String(items.length));
  stat('W / L / BE',`${wins} / ${losses} / ${breakeven}`);
  stat('Plan followed',`${followed} of ${items.length}`,followed===items.length?'green':'amber');
  const pnlStat=make('div','day-records-stat day-records-pnl');
  pnlStat.append(make('span','','Day P&L'),make('strong',totals.size===1?(net>0?'green':net<0?'red':''):'',formatTotals(totals)));
  stats.append(pnlStat);
  header.append(stats);
  const list=make('div','day-records-grid');
  const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:calendarTimezone,hour:'2-digit',minute:'2-digit'});
  items.forEach(trade=>{
    const outcome=trade.outcome||'BREAKEVEN';
    const tone=outcome==='WIN'?'win':outcome==='LOSS'?'loss':'even';
    const record=make('article',`calendar-record record-card record-${tone}`);
    const head=make('div','calendar-record-head');
    const identity=make('div','record-identity');
    identity.append(make('span',`record-outcome record-outcome-${tone}`,outcome==='BREAKEVEN'?'BREAKEVEN':outcome));
    const title=make('div','record-title');
    title.append(make('strong','',trade.instrument||'Trade'));
    if(trade.side)title.append(make('span',`record-side record-side-${trade.side.toLowerCase()}`,trade.side));
    identity.append(title);
    const amount=Number(trade.pnl||0);
    const pnl=make('div','record-pnl');
    pnl.append(
      make('strong',amount>0?'green':amount<0?'red':'',`${amount>0?'+':''}${amount.toFixed(2)}`),
      make('span','',trade.currency||'USD')
    );
    head.append(identity,pnl);
    record.append(head);
    const chips=make('div','record-chips');
    if(trade.createdAt)chips.append(make('span','record-chip',timeFormat.format(new Date(trade.createdAt))));
    if(trade.account)chips.append(make('span','record-chip',trade.account));
    if(trade.session)chips.append(make('span','record-chip',trade.session));
    const emotion=trade.emotion||'calm';
    chips.append(make('span',`record-chip ${emotion==='calm'?'':'record-chip-warn'}`,emotion.toUpperCase()));
    chips.append(make('span',`record-chip ${trade.followedPlan===false?'record-chip-bad':'record-chip-good'}`,trade.followedPlan===false?'PLAN BROKEN':'PLAN FOLLOWED'));
    if(trade.checklistCompleted===true)chips.append(make('span','record-chip','CHECKLIST COMPLETED'));
    else if(trade.checklistCompleted===false)chips.append(make('span','record-chip record-chip-bad','CHECKLIST MISSED'));
    record.append(chips);
    if(trade.planDeviationReason){
      const reason=make('p','calendar-record-notes');
      reason.append(make('span','record-label','PLAN DEVIATION'),document.createTextNode(trade.planDeviationReason));
      record.append(reason);
    }
    if(trade.strategy){
      const strategy=make('p','calendar-record-strategy');
      strategy.append(make('span','record-label','STRATEGY'),document.createTextNode(trade.strategy));
      record.append(strategy);
    }
    if(trade.notes)record.append(make('p','calendar-record-notes',trade.notes));
    if(trade.hasImage){
      const imageButton=make('button','image-preview-trigger record-image');
      imageButton.type='button';
      imageButton.dataset.imageSrc=`/trades/${encodeURIComponent(trade.id)}/image`;
      imageButton.setAttribute('aria-label',`Preview image for ${trade.instrument||'trade'}`);
      const image=document.createElement('img');
      image.src=imageButton.dataset.imageSrc;
      image.alt='Trade attachment thumbnail';
      image.loading='lazy';
      imageButton.append(image);
      bindImagePreview(imageButton);
      record.append(imageButton);
    }
    const actions=make('div','journal-actions record-actions');
    const edit=make('button','textbutton trade-edit-trigger','EDIT');
    edit.type='button';
    edit.setAttribute('aria-label',`Edit ${trade.instrument||'trade'} record`);
    edit.addEventListener('click',()=>editTrade(trade.id));
    actions.append(edit);
    const deleteForm=document.createElement('form');
    deleteForm.method='post';
    deleteForm.action=`/trades/${encodeURIComponent(trade.id)}/delete`;
    deleteForm.addEventListener('submit',event=>{
      if(!window.confirm('Delete this trade?'))event.preventDefault();
    });
    const csrf=document.createElement('input');
    csrf.type='hidden';
    csrf.name='_csrf';
    csrf.value=grid.dataset.csrf;
    const remove=make('button','textbutton danger-text','DELETE');
    remove.type='submit';
    remove.setAttribute('aria-label',`Delete ${trade.instrument||'trade'} record`);
    deleteForm.append(csrf,remove);
    actions.append(deleteForm);
    record.append(actions);
    list.append(record);
  });
  selected.append(list);
}const calendarNet=items=>items.reduce((sum,trade)=>sum+Number(trade.pnl||0),0);
const calendarTone=value=>value>0?'positive':value<0?'negative':'neutral';
const calendarMoney=value=>new Intl.NumberFormat('en-US',{
  style:'currency',currency:selectedCalendarCurrency,currencyDisplay:'narrowSymbol',
  signDisplay:'exceptZero',minimumFractionDigits:2,maximumFractionDigits:2
}).format(value);
const calendarWinRate=items=>{
  const wins=items.filter(trade=>trade.outcome==='WIN').length;
  const decided=items.filter(trade=>trade.outcome!=='BREAKEVEN').length;
  return decided?`${Math.round(wins/decided*100)}%`:'—';
};
function renderCalendar(){
  const year=current.getFullYear(),month=current.getMonth();
  const items=trades.filter(trade=>(trade.currency||'USD')===selectedCalendarCurrency);
  const yearItems=items.filter(trade=>trade.date.startsWith(`${year}-`));
  const months=Array.from({length:12},(_,index)=>{
    const prefix=`${year}-${String(index+1).padStart(2,'0')}`;
    const records=yearItems.filter(trade=>trade.date.startsWith(prefix));
    return{records,value:calendarNet(records),label:new Date(year,index,1).toLocaleString('en-US',{month:'short'})};
  });
  const monthTrades=months[month].records;
  const monthValue=calendarNet(monthTrades);
  const daily=new Map();
  monthTrades.forEach(trade=>{
    const records=daily.get(trade.date)||[];
    records.push(trade);
    daily.set(trade.date,records);
  });
  title.textContent=current.toLocaleString('en-US',{month:'long',year:'numeric'});
  const years=[...new Set([calendarYear-1,calendarYear,year,...trades.map(trade=>Number(trade.date.slice(0,4)))])].sort((a,b)=>a-b);
  const yearButtons=document.getElementById('calendarYears');
  yearButtons.replaceChildren();
  years.forEach(value=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=value===year?'is-selected':'';
    button.setAttribute('aria-pressed',String(value===year));
    const yearTotal=calendarNet(items.filter(trade=>trade.date.startsWith(`${value}-`)));
    const yearPnl=document.createElement('span');
    yearPnl.className=`calendar-year-pnl ${calendarTone(yearTotal)}`;
    yearPnl.textContent=calendarMoney(yearTotal);
    button.append(`${value}  `,yearPnl);
    button.addEventListener('click',()=>{
      current.setFullYear(value);
      renderCalendar();
    });
    yearButtons.append(button);
  });
  const profitableMonths=months.filter(entry=>entry.records.length&&entry.value>0).length;
  const recordedMonths=months.filter(entry=>entry.records.length).length;
  document.getElementById('calendarYearCaption').textContent=`${profitableMonths} of ${recordedMonths} recorded months profitable · ${selectedCalendarCurrency} · ${year}`;
  const monthlyChart=document.getElementById('monthlyPerformance');
  const monthRows=document.getElementById('calendarMonthRows');
  monthlyChart.replaceChildren();
  monthRows.replaceChildren();
  const maxMonth=Math.max(1,...months.map(entry=>Math.abs(entry.value)));
  months.forEach((entry,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=`month-performance ${calendarTone(entry.value)}${index===month?' is-selected':''}`;
    button.setAttribute('aria-pressed',String(index===month));
    button.setAttribute('aria-label',`${entry.label} ${year}: ${entry.records.length?calendarMoney(entry.value):'No trades'}`);
    const value=document.createElement('strong');
    value.textContent=entry.records.length?calendarMoney(entry.value):'—';
    const track=document.createElement('span');
    track.className='month-bar-track';
    const bar=document.createElement('span');
    bar.style.height=entry.records.length?`${Math.max(3,Math.abs(entry.value)/maxMonth*100)}%`:'0%';
    track.append(bar);
    const label=document.createElement('span');
    label.textContent=entry.label;
    button.append(value,track,label);
    button.addEventListener('click',()=>{
      current.setMonth(index);
      renderCalendar();
    });
    monthlyChart.append(button);
    const row=document.createElement('tr');
    [entry.label,String(entry.records.length),calendarWinRate(entry.records),entry.records.length?calendarMoney(entry.value):'—'].forEach((text,column)=>{
      const cell=document.createElement(column===0?'th':'td');
      if(column===0)cell.scope='row';
      if(column===3)cell.className=calendarTone(entry.value);
      cell.textContent=text;
      row.append(cell);
    });
    monthRows.append(row);
  });
  monthPnl.textContent=calendarMoney(monthValue);
  monthPnl.className=`month-pnl ${calendarTone(monthValue)}`;
  document.getElementById('calendarMonthCaption').textContent=`${selectedCalendarCurrency} net result · ${monthTrades.length} trades`;
  const stats=document.getElementById('calendarMonthStats');
  stats.replaceChildren();
  const dailyResults=[...daily].map(([date,records])=>({date,value:calendarNet(records)}));
  const best=dailyResults.reduce((result,day)=>!result||day.value>result.value?day:result,null);
  const worst=dailyResults.reduce((result,day)=>!result||day.value<result.value?day:result,null);
  const profitableDays=dailyResults.filter(day=>day.value>0).length;
  const statValues=[
    ['TRADES',String(monthTrades.length)],
    ['WIN RATE',calendarWinRate(monthTrades)],
    ['PROFITABLE DAYS',`${profitableDays} of ${daily.size}`],
    ['BEST DAY',best?`${calendarMoney(best.value)} · ${best.date.slice(5)}`:'—',best?.value],
    ['WORST DAY',worst?`${calendarMoney(worst.value)} · ${worst.date.slice(5)}`:'—',worst?.value]
  ];
  statValues.forEach(([label,value,tone])=>{
    const cell=document.createElement('div');
    const name=document.createElement('span');
    name.textContent=label;
    const result=document.createElement('strong');
    result.textContent=value;
    if(tone!==undefined)result.className=calendarTone(tone);
    cell.append(name,result);
    stats.append(cell);
  });
  grid.replaceChildren();
  // Weekend columns appear only when the month has weekend trades, so no records are hidden.
  const showWeekends=monthTrades.some(trade=>[0,6].includes(new Date(`${trade.date}T12:00:00Z`).getUTCDay()));
  grid.classList.toggle('show-weekends',showWeekends);
  (showWeekends?['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Week']:['Mon','Tue','Wed','Thu','Fri','Week']).forEach(day=>{
    const weekday=document.createElement('div');
    weekday.className='weekday';
    weekday.textContent=day;
    grid.append(weekday);
  });
  const offset=(new Date(year,month,1).getDay()+6)%7;
  const days=new Date(year,month+1,0).getDate();
  const cellCount=Math.ceil((offset+days)/7)*7;
  let weekTrades=[];
  for(let index=0;index<cellCount;index++){
    const day=index-offset+1;
    const column=index%7;
    if(!showWeekends&&column===0&&index-offset+5<1){
      index+=6;
      continue;
    }
    if(!showWeekends&&column>=5){
      if(column<6)continue;
    }else if(day<1||day>days){
      const blank=document.createElement('div');
      blank.className='blank';
      blank.textContent=new Date(year,month,day).getDate();
      blank.setAttribute('aria-hidden','true');
      grid.append(blank);
    }else{
      const date=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dayTrades=daily.get(date)||[];
      const value=calendarNet(dayTrades);
      weekTrades.push(...dayTrades);
      const button=document.createElement('button');
      button.type='button';
      button.dataset.date=date;
      button.className=`day${dayTrades.length?` ${calendarTone(value)}`:''}${date===calendarToday?' is-today':''}${date===selectedCalendarDate?' is-selected':''}`;
      button.setAttribute('aria-pressed',String(date===selectedCalendarDate));
      button.setAttribute('aria-label',`${date}: ${dayTrades.length} ${selectedCalendarCurrency} trades${dayTrades.length?`, ${calendarMoney(value)}`:''}. Open all trade records for this date.`);
      const number=document.createElement('span');
      number.className='calendar-day-number';
      number.textContent=day;
      const pnl=document.createElement('strong');
      pnl.className=`calendar-day-pnl${dayTrades.length?'':' is-empty'}`;
      pnl.textContent=dayTrades.length?calendarMoney(value):'—';
      button.append(number,pnl);
      if(dayTrades.length){
        const footer=document.createElement('span');
        footer.className='calendar-day-footer';
        const meta=document.createElement('small');
        meta.textContent=`${dayTrades.length} ${dayTrades.length===1?'trade':'trades'}`;
        const outcomes=document.createElement('small');
        outcomes.className='calendar-day-outcomes';
        outcomes.textContent=`${dayTrades.filter(trade=>trade.outcome==='WIN').length}W / ${dayTrades.filter(trade=>trade.outcome==='LOSS').length}L`;
        footer.append(meta,outcomes);
        button.append(footer);
      }
      button.addEventListener('click',()=>showDay(date,trades.filter(trade=>trade.date===date)));
      grid.append(button);
    }
    if(index%7===6){
      const total=calendarNet(weekTrades);
      const week=document.createElement('div');
      week.className=`calendar-week-total ${calendarTone(total)}${weekTrades.length?'':' is-empty'}`;
      week.textContent=weekTrades.length?calendarMoney(total):'—';
      week.setAttribute('aria-label',`Week ${Math.floor(index/7)+1} P&L, selected month only: ${calendarMoney(total)} ${selectedCalendarCurrency}`);
      grid.append(week);
      weekTrades=[];
    }
  }
  if(selectedCalendarDate&&!selectedCalendarDate.startsWith(`${year}-${String(month+1).padStart(2,'0')}-`)){
    selectedCalendarDate='';
    selected.textContent='Select a day to review its trade records.';
  }
  renderAnalysis();
}
calendarCurrency.addEventListener('change',()=>{
  selectedCalendarCurrency=calendarCurrency.value;
  renderCalendar();
});
analysisRangeButtons.forEach(button=>button.addEventListener('click',()=>{
  analysisRange=button.dataset.analysisRange;
  renderAnalysis();
}));
analysisCurrency.addEventListener('change',()=>{
  selectedAnalysisCurrency=analysisCurrency.value;
  renderAnalysis();
});
document.getElementById('prevMonth').addEventListener('click',()=>{
  current.setMonth(current.getMonth()-1);
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click',()=>{
  current.setMonth(current.getMonth()+1);
  renderCalendar();
});
renderCalendar();
})();
