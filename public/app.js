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
  updateOutcomePnlWarning(document.getElementById('journalTradeForm'));
  activateTab('journal');
  if(window.location.hash!=='#journal')window.history.pushState(null,'','#journal');
  document.getElementById('journalTradeForm')?.scrollIntoView({behavior:'smooth',block:'start'});
  outcome.focus({preventScroll:true});
}));
window.addEventListener('hashchange',tabFromHash);
window.addEventListener('popstate',tabFromHash);
tabFromHash();

const checklistForm=document.getElementById('checklistForm');
if(checklistForm){
  const checkboxes=[...checklistForm.querySelectorAll('input[name="rules"]')];
  const progress=document.getElementById('checklistProgress');
  const summaryValue=document.getElementById('checklistProgressValue');
  const count=document.getElementById('checklistCount');
  const segments=progress?[...progress.querySelectorAll('i')]:[];
  const updateChecklistProgress=()=>{
    const checked=checkboxes.filter(input=>input.checked).length;
    if(count)count.textContent=`${checked} OF ${checkboxes.length}`;
    if(summaryValue)summaryValue.textContent=`${checked} of ${checkboxes.length}`;
    if(progress)progress.setAttribute('aria-valuenow',String(checked));
    segments.forEach((segment,index)=>segment.classList.toggle('is-filled',index<checked));
  };
  checklistForm.addEventListener('change',updateChecklistProgress);
  checklistForm.addEventListener('reset',()=>setTimeout(updateChecklistProgress,0));
  updateChecklistProgress();
}

function renderCountdown(timer,totalSeconds){
  const values=[Math.floor(totalSeconds/86400),Math.floor(totalSeconds%86400/3600),Math.floor(totalSeconds%3600/60),totalSeconds%60];
  if(timer.dataset.countdownStyle==='units'){
    timer.querySelectorAll('[data-countdown-part]').forEach((part,index)=>{
      part.textContent=index?String(values[index]).padStart(2,'0'):String(values[index]);
    });
  }else{
    timer.textContent=`${values[0]}d ${String(values[1]).padStart(2,'0')}h ${String(values[2]).padStart(2,'0')}m ${String(values[3]).padStart(2,'0')}s`;
  }
}
const countdowns=[...document.querySelectorAll('[data-until]')];
if(countdowns.length){
  const reloadKey='discipline-unlock-reloaded';
  const tick=()=>{
    countdowns.forEach(timer=>{
      const until=Date.parse(timer.dataset.until||'');
      const seconds=Number.isFinite(until)?Math.max(0,Math.ceil((until-Date.now())/1000)):0;
      const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),remainingSeconds=seconds%60;
      renderCountdown(timer,seconds);
      timer.setAttribute('aria-label',`${days} days, ${hours} hours, ${minutes} minutes, ${remainingSeconds} seconds until ${timer.dataset.countdownLabel||'trading is available'}`);
      timer.classList.toggle('counting',seconds>0);
    });
    const expired=countdowns.filter(timer=>{
      const until=Date.parse(timer.dataset.until||'');
      return Number.isFinite(until)&&until<=Date.now();
    }).sort((a,b)=>Date.parse(b.dataset.until)-Date.parse(a.dataset.until))[0];
    if(expired&&sessionStorage.getItem(reloadKey)!==expired.dataset.until){
      sessionStorage.setItem(reloadKey,expired.dataset.until);
      window.location.reload();
    }
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
  const panel=document.getElementById('nySessionPanel');
  const badge=document.getElementById('nySessionBadge');
  const liveBanner=document.getElementById('nyLiveBanner');
  const liveLabel=document.getElementById('nyLiveLabel');
  const liveCountdown=document.getElementById('nyLiveCountdown');
  const timelineNow=document.getElementById('nySessionNow');
  const sessionWhen=document.getElementById('nySessionWhen');
  const sessionTimes={
    premarket:{time:document.getElementById('nyTimePremarket'),date:document.getElementById('nyDatePremarket')},
    open:{time:document.getElementById('nyTimeOpen'),date:document.getElementById('nyDateOpen')},
    close:{time:document.getElementById('nyTimeClose'),date:document.getElementById('nyDateClose')}
  };
  const clockText=ms=>{const total=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(total/3600)}h ${String(Math.floor(total%3600/60)).padStart(2,'0')}m ${String(total%60).padStart(2,'0')}s`};
  const tickNySession=()=>{
    const now=Date.now();
    const nextEventIndex=schedule.findIndex(event=>Date.parse(event.at)>now);
    const nextEvent=schedule[nextEventIndex];
    const nextPremarket=schedule.find(event=>event.type==='premarket'&&Date.parse(event.at)>now);
    if(!nextEvent){
      nySessionTimer.textContent='Schedule unavailable';
      phase.textContent='REFRESH FOR UPCOMING PRE-MARKET';
      liveBanner.hidden=true;
      panel.classList.remove('is-premarket','is-regular');
      badge.textContent='SCHEDULE UNAVAILABLE';
      milestone.textContent='REFRESH FOR UPCOMING PRE-MARKET';
      timelineNow.hidden=true;
      Object.values(sessionTimes).forEach(({time,date})=>{time.textContent='—';date.textContent=''});
      if(sessionWhen)sessionWhen.textContent='';
      return;
    }
    const remaining=Math.max(0,Math.ceil((Date.parse(nextEvent.at)-now)/1000));
    renderCountdown(nySessionTimer,remaining);
    nySessionTimer.setAttribute('aria-label',`${remaining} seconds until ${nextEvent.type==='premarket'?'pre-market opens':nextEvent.type==='open'?'New York opens':'New York closes'}`);
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
    const nextDateFormat=new Intl.DateTimeFormat('en-GB',{timeZone:accountTimezone,weekday:'short',day:'numeric',month:'short'});
    badge.textContent=live==='premarket'?'PRE-MARKET OPEN':live==='regular'?'NY SESSION OPEN':`NEXT: ${nextDateFormat.format(new Date(nextEvent.at)).toUpperCase()}`;
    if(sessionWhen){
      const accountFormat=new Intl.DateTimeFormat('en-GB',{timeZone:accountTimezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
      const nyFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
      const local=document.createElement('b');
      local.textContent=accountFormat.format(new Date(nextEvent.at));
      sessionWhen.replaceChildren(local,` your time · ${nyFormat.format(new Date(nextEvent.at))} ET`);
    }
    liveBanner.hidden=!live;
    if(live){
      liveLabel.textContent=live==='premarket'?'PRE-MARKET OPEN':'NY SESSION OPEN';
      liveCountdown.textContent=`${live==='premarket'?'NY OPEN IN':'CLOSES IN'} ${clockText(Date.parse(nextEvent.at)-now)}`;
    }
    milestone.textContent=live==='premarket'?'NY OPENS · 9:30 AM ET':live==='regular'?'NY CLOSES · 4:00 PM ET':'NEXT PRE-MARKET · 8:30 AM ET';
    timelineNow.hidden=!live;
    if(live){
      const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
      const value=type=>Number(parts.find(part=>part.type===type).value);
      const minutes=value('hour')*60+value('minute')+value('second')/60;
      timelineNow.style.left=`${Math.max(0,Math.min(100,(minutes-510)/450*100))}%`;
    }
    const premarketIndex=live?
      schedule.findLastIndex((event,index)=>index<nextEventIndex&&event.type==='premarket'):
      schedule.findIndex(event=>event===nextPremarket);
    const sessionEvents=premarketIndex<0?[]:schedule.slice(premarketIndex,premarketIndex+3);
    const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:accountTimezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const dateFormat=new Intl.DateTimeFormat('en-GB',{timeZone:accountTimezone,weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
    const shortDateFormat=new Intl.DateTimeFormat('en-GB',{timeZone:accountTimezone,weekday:'short',day:'numeric',month:'short'});
    Object.entries(sessionTimes).forEach(([type,{time,date}])=>{
      const event=sessionEvents.find(item=>item.type===type);
      time.textContent=event?timeFormat.format(new Date(event.at)):'—';
      time.title=event?dateFormat.format(new Date(event.at)):'Schedule unavailable';
      date.textContent=event?shortDateFormat.format(new Date(event.at)):'';
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
      let nextOpen=toSessionTime(local,session.open,session.timezone);
      let openingDay=new Date(Date.UTC(Number(local.year),Number(local.month)-1,Number(local.day)));
      while(nextOpen<=now||openingDay.getUTCDay()===0||openingDay.getUTCDay()===6){
        openingDay.setUTCDate(openingDay.getUTCDate()+1);
        nextOpen=toSessionTime({
          year:openingDay.getUTCFullYear(),month:openingDay.getUTCMonth()+1,day:openingDay.getUTCDate()
        },session.open,session.timezone);
      }
      const sessionDay=active?local:{
        year:openingDay.getUTCFullYear(),month:openingDay.getUTCMonth()+1,day:openingDay.getUTCDate()
      };
      const openAt=active?toSessionTime(local,session.open,session.timezone):nextOpen;
      const closeAt=toSessionTime(sessionDay,session.close,session.timezone);
      const openTime=formatSofiaTime.format(openAt);
      const closeTime=formatSofiaTime.format(closeAt);
      const countdown=card.querySelector('.fx-session-countdown');
      const countdownTarget=active?closeAt:openAt;
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
const noSetupEntries=JSON.parse(document.getElementById('no-setup-data').textContent);
function updatePlanDeviation(form){
  const followedPlan=form.querySelector('[name="followedPlan"]');
  const field=form.querySelector('[data-plan-deviation]');
  const reason=field?.querySelector('[name="planDeviationReason"]');
  if(!followedPlan||!field||!reason)return;
  const status=followedPlan.type==='checkbox'?(followedPlan.checked?'yes':'no'):followedPlan.value;
  const needsReason=status==='no';
  field.hidden=!needsReason;
  reason.required=needsReason;
}
document.querySelectorAll('[data-plan-follow-up]').forEach(form=>{
  form.querySelector('[name="followedPlan"]')?.addEventListener('change',()=>updatePlanDeviation(form));
  updatePlanDeviation(form);
});
function outcomePnlMismatch(outcome,pnl){
  if(!Number.isFinite(pnl))return false;
  if(outcome==='WIN')return pnl<=0;
  if(outcome==='LOSS')return pnl>=0;
  if(outcome==='BREAKEVEN')return pnl!==0;
  return false;
}
function updateOutcomePnlWarning(form){
  const outcome=form.querySelector('[name="outcome"]');
  const pnl=form.querySelector('[name="pnl"]');
  const warning=form.querySelector('[data-outcome-pnl-warning]');
  const mismatch=outcomePnlMismatch(outcome.value,Number(pnl.value));
  warning.hidden=!mismatch;
  warning.textContent=warning.hidden?'':'Outcome and P&L do not match. Check these values before saving.';
}
document.querySelectorAll('[data-outcome-pnl]').forEach(form=>{
  const outcome=form.querySelector('[name="outcome"]');
  const pnl=form.querySelector('[name="pnl"]');
  const mismatch=()=>outcomePnlMismatch(outcome.value,Number(pnl.value));
  outcome.addEventListener('change',()=>updateOutcomePnlWarning(form));
  pnl.addEventListener('input',()=>updateOutcomePnlWarning(form));
  form.addEventListener('submit',event=>{
    if(mismatch()&&!window.confirm('The outcome and P&L do not match. Save this record anyway?'))event.preventDefault();
  });
  updateOutcomePnlWarning(form);
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
const imageViewport=document.getElementById('imagePreviewViewport');
const imageZoomIn=document.getElementById('imageZoomIn');
const imageZoomOut=document.getElementById('imageZoomOut');
const imageZoomReset=document.getElementById('imageZoomReset');
const imagePreviewTradingView=document.getElementById('imagePreviewTradingView');
let imageZoom=1;
let imageDrag=null;
const updateImageZoom=()=>{
  const fitWidth=Math.min(fullImage.naturalWidth,imageViewport.clientWidth,
    imageViewport.clientHeight*fullImage.naturalWidth/fullImage.naturalHeight);
  fullImage.style.width=`${fitWidth*imageZoom}px`;
  imageZoomReset.textContent=`${Math.round(imageZoom*100)}%`;
  imageZoomOut.disabled=imageZoom<=1;
  imageZoomIn.disabled=imageZoom>=4;
  imageZoomReset.disabled=imageZoom===1;
  imageViewport.classList.toggle('is-zoomed',imageZoom>1);
};
const changeImageZoom=zoom=>{
  const oldWidth=fullImage.clientWidth,oldHeight=fullImage.clientHeight;
  const centerX=imageViewport.scrollLeft+imageViewport.clientWidth/2;
  const centerY=imageViewport.scrollTop+imageViewport.clientHeight/2;
  imageZoom=Math.max(1,Math.min(4,zoom));
  updateImageZoom();
  imageViewport.scrollLeft=centerX*fullImage.clientWidth/oldWidth-imageViewport.clientWidth/2;
  imageViewport.scrollTop=centerY*fullImage.clientHeight/oldHeight-imageViewport.clientHeight/2;
};
imageZoomIn.addEventListener('click',()=>changeImageZoom(imageZoom+0.25));
imageZoomOut.addEventListener('click',()=>changeImageZoom(imageZoom-0.25));
imageZoomReset.addEventListener('click',()=>changeImageZoom(1));
imageViewport.addEventListener('pointerdown',event=>{
  if(imageZoom<=1||!event.isPrimary||event.button!==0)return;
  imageDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:imageViewport.scrollLeft,top:imageViewport.scrollTop};
  imageViewport.setPointerCapture(event.pointerId);
  imageViewport.classList.add('is-dragging');
});
imageViewport.addEventListener('pointermove',event=>{
  if(!imageDrag||event.pointerId!==imageDrag.pointerId)return;
  imageViewport.scrollLeft=imageDrag.left+imageDrag.x-event.clientX;
  imageViewport.scrollTop=imageDrag.top+imageDrag.y-event.clientY;
});
const endImageDrag=event=>{
  if(!imageDrag||event.pointerId!==imageDrag.pointerId)return;
  imageDrag=null;
  imageViewport.classList.remove('is-dragging');
};
imageViewport.addEventListener('pointerup',endImageDrag);
imageViewport.addEventListener('pointercancel',endImageDrag);
imageViewport.addEventListener('lostpointercapture',endImageDrag);
window.addEventListener('resize',()=>{if(imageDialog.open&&!fullImage.hidden)updateImageZoom()});
fullImage.addEventListener('load',()=>{
  imagePreviewStatus.hidden=true;
  imageViewport.hidden=false;
  fullImage.hidden=false;
  imageZoom=1;
  imageViewport.scrollLeft=0;
  imageViewport.scrollTop=0;
  updateImageZoom();
});
fullImage.addEventListener('error',()=>{
  imagePreviewStatus.textContent='Could not load this image. Close the preview and try again.';
  imagePreviewStatus.hidden=false;
  imageViewport.hidden=true;
  fullImage.hidden=true;
  imageZoomIn.disabled=true;
  imageZoomOut.disabled=true;
  imageZoomReset.disabled=true;
});
function bindImagePreview(button){
  button.addEventListener('click',()=>{
    imagePreviewStatus.textContent='Loading image preview…';
    imagePreviewStatus.hidden=false;
    imageViewport.hidden=true;
    fullImage.hidden=true;
    imageZoomIn.disabled=true;
    imageZoomOut.disabled=true;
    imageZoomReset.disabled=true;
    imageZoomReset.textContent='100%';
    const snapshotId=button.dataset.tradingViewId||'';
    imagePreviewTradingView.hidden=!tradingViewSnapshotImageUrl(snapshotId);
    if(imagePreviewTradingView.hidden)imagePreviewTradingView.removeAttribute('href');
    else imagePreviewTradingView.href=`https://www.tradingview.com/x/${snapshotId}/`;
    imageDialog.showModal();
    fullImage.src=button.dataset.imageSrc;
    if(fullImage.complete){
      if(fullImage.naturalWidth)fullImage.dispatchEvent(new Event('load'));
      else fullImage.dispatchEvent(new Event('error'));
    }
  });
}
function tradingViewSnapshotId(value){
  try{
    const url=new URL(value.trim());
    if(url.protocol!=='https:'||url.hostname!=='www.tradingview.com'||url.port||url.username||url.password)return null;
    return url.pathname.match(/^\/x\/([a-z0-9]{8})\/?$/i)?.[1]||null;
  }catch{
    return null;
  }
}
function tradingViewSnapshotImageUrl(id){
  return /^[a-z0-9]{8}$/i.test(id)?`https://s3.tradingview.com/snapshots/${id[0].toLowerCase()}/${id}.png`:'';
}
function createTradingViewPreviewButton(id,label){
  const imageSrc=tradingViewSnapshotImageUrl(id);
  if(!imageSrc)return null;
  const button=document.createElement('button');
  button.type='button';
  button.className='image-preview-trigger';
  button.dataset.imageSrc=imageSrc;
  button.dataset.tradingViewId=id;
  button.setAttribute('aria-label',label);
  const image=document.createElement('img');
  image.src=imageSrc;
  image.alt=label;
  image.loading='lazy';
  button.append(image);
  bindImagePreview(button);
  return button;
}
function updateTradingViewPreview(form){
  const input=form.querySelector('[data-tradingview-input]');
  const preview=form.querySelector('[data-tradingview-preview]');
  if(!input||!preview)return;
  preview.replaceChildren();
  const value=input.value.trim();
  if(!value){
    preview.hidden=true;
    return;
  }
  const id=tradingViewSnapshotId(value);
  if(!id){
    preview.textContent='Enter a valid public TradingView snapshot URL to preview its chart.';
    preview.hidden=false;
    return;
  }
  const button=createTradingViewPreviewButton(id,'Preview TradingView chart snapshot');
  if(!button){
    preview.textContent='Could not create a preview for this TradingView snapshot.';
    preview.hidden=false;
    return;
  }
  const link=document.createElement('a');
  link.href=`https://www.tradingview.com/x/${id}/`;
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.className='tradingview-preview-link';
  link.textContent='OPEN ON TRADINGVIEW';
  preview.append(button,link);
  preview.hidden=false;
}
document.querySelectorAll('.image-preview-trigger').forEach(bindImagePreview);
document.querySelectorAll('[data-image-upload]').forEach(form=>{
  const input=form.querySelector('[data-image-input]');
  const preview=form.querySelector('[data-upload-preview]');
  const error=form.querySelector('.upload-error');
  const tradingViewInput=form.querySelector('[data-tradingview-input]');
  if(tradingViewInput){
    form.updateTradingViewPreview=()=>updateTradingViewPreview(form);
    tradingViewInput.addEventListener('input',form.updateTradingViewPreview);
    form.updateTradingViewPreview();
  }
  let previewUrls=[];
  const clearPreview=()=>{
    previewUrls.forEach(url=>URL.revokeObjectURL(url));
    previewUrls=[];
    preview.replaceChildren();
    preview.hidden=true;
  };
  form.clearImagePreview=clearPreview;
  input.addEventListener('change',()=>{
    clearPreview();
    error.hidden=true;
    const files=[...input.files];
    if(!files.length)return;
    if(files.length>10||files.some(file=>file.size>5*1024*1024)){
      input.value='';
      error.textContent=files.length>10?'You can upload up to 10 images at a time.':'Images must be 5 MB or smaller.';
      error.hidden=false;
      return;
    }
    files.forEach((file,index)=>{
      const objectUrl=URL.createObjectURL(file);
      previewUrls.push(objectUrl);
      const button=document.createElement('button');
      button.type='button';
      button.className='image-preview-trigger';
      button.dataset.imageSrc=objectUrl;
      button.setAttribute('aria-label',`Preview selected trade image ${index+1}`);
      const image=document.createElement('img');
      image.src=objectUrl;
      image.alt=`Selected trade image ${index+1}`;
      button.append(image);
      bindImagePreview(button);
      preview.append(button);
    });
    preview.hidden=false;
  });
  form.addEventListener('submit',async event=>{
    if(event.defaultPrevented)return;
    event.preventDefault();
    error.hidden=true;
    const existingCount=form.querySelectorAll('#tradeExistingImage .trade-existing-image').length;
    const removingCount=form.querySelectorAll('#tradeExistingImage input[name="removeImages"]:checked').length;
    if(existingCount-removingCount+input.files.length>10){
      error.textContent='A trade can have up to 10 images. Remove an image before adding another.';
      error.hidden=false;
      return;
    }
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
  accountCount:document.getElementById('tradeAccountCount'),
  session:document.getElementById('tradeSession'),
  tradeTime:document.getElementById('tradeTime'),
  instrument:document.getElementById('tradeInstrument'),
  side:document.getElementById('tradeSide'),
  outcome:document.getElementById('tradeOutcome'),
  pnl:document.getElementById('tradePnl'),
  currency:document.getElementById('tradeCurrency'),
  strategy:document.getElementById('tradeStrategy'),
  tradingViewUrl:document.getElementById('tradeTradingViewUrl'),
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
  tradeFields.accountCount.value=String(Number(trade.accountCount)||1);
  tradeFields.session.value=trade.session||'';
  tradeFields.tradeTime.value=trade.tradeTime||'';
  tradeFields.instrument.value=trade.instrument||'';
  tradeFields.side.value=trade.side||'';
  tradeFields.outcome.value=trade.outcome;
  tradeFields.pnl.value=Number(trade.pnl||0).toFixed(2);
  updateOutcomePnlWarning(tradeEditor);
  tradeFields.currency.value=trade.currency||'USD';
  tradeFields.strategy.value=trade.strategy||'';
  tradeFields.emotion.value=trade.emotion||'calm';
  tradeFields.followedPlan.value=trade.followedPlan===true?'yes':trade.followedPlan===false?'no':'unknown';
  tradeFields.planDeviationReason.value=trade.planDeviationReason||'';
  updatePlanDeviation(tradeEditor);
  document.getElementById('tradeReturnDate').value=selectedCalendarDate||trade.date;
  tradeFields.notes.value=trade.notes||'';
  tradeFields.tradingViewUrl.value=trade.tradingViewId?`https://www.tradingview.com/x/${trade.tradingViewId}/`:'';
  tradeEditor.updateTradingViewPreview();
  document.getElementById('tradeChecklistStatus').textContent=trade.checklistCompleted===true?
    'Checklist was completed when this trade was recorded.':
    trade.checklistCompleted===false?'Checklist was not completed when this trade was recorded.':'Checklist status was not recorded for this older trade.';
  const existingImage=document.getElementById('tradeExistingImage');
  existingImage.replaceChildren();
  (trade.images||[]).forEach((imageId,index)=>{
    const item=document.createElement('div');
    item.className='trade-existing-image';
    const preview=document.createElement('button');
    preview.type='button';
    preview.className='image-preview-trigger';
    preview.dataset.imageSrc=`/trades/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`;
    preview.setAttribute('aria-label',`Preview current trade image ${index+1}`);
    const image=document.createElement('img');
    image.src=preview.dataset.imageSrc;
    image.alt=`Current trade attachment ${index+1}`;
    preview.append(image);
    bindImagePreview(preview);
    const removeLabel=document.createElement('label');
    removeLabel.className='inline-check';
    const remove=document.createElement('input');
    remove.type='checkbox';
    remove.name='removeImages';
    remove.value=imageId;
    removeLabel.append(remove,document.createTextNode(' REMOVE'));
    item.append(preview,removeLabel);
    existingImage.append(item);
  });
  tradeEditor.clearImagePreview();
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

const grid=document.getElementById('calendarGrid');
const calendarTimezone=grid.dataset.timezone||'Europe/Sofia';
const calendarToday=grid.dataset.today||new Intl.DateTimeFormat('en-CA',{
  timeZone:calendarTimezone,year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
const requestedCalendarDate=new URLSearchParams(window.location.search).get('calendarDate')||'';
const requestedCalendarDateObject=new Date(`${requestedCalendarDate}T00:00:00Z`);
const validRequestedCalendarDate=/^\d{4}-\d{2}-\d{2}$/.test(requestedCalendarDate)&&
  Number.isFinite(requestedCalendarDateObject.getTime())&&
  requestedCalendarDateObject.toISOString().slice(0,10)===requestedCalendarDate;
const initialCalendarDate=validRequestedCalendarDate?requestedCalendarDate:calendarToday;
const [calendarYear,calendarMonth]=calendarToday.split('-').map(Number);
const [initialYear,initialMonth]=initialCalendarDate.split('-').map(Number);
const current=new Date(initialYear,initialMonth-1,1);
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
let selectedCalendarDate=validRequestedCalendarDate?requestedCalendarDate:'';
let monthTradesExpanded=false;
const analysisRangeButtons=[...document.querySelectorAll('[data-analysis-range]')];
const analysisPeriodLabel=document.getElementById('analysisPeriodLabel');
const analysisTradeCount=document.getElementById('analysisTradeCount');
const analysisNoSetupCount=document.getElementById('analysisNoSetupCount');
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
function getAnalysisRecords(records){
  const year=current.getFullYear(),month=String(current.getMonth()+1).padStart(2,'0');
  if(analysisRange==='month'){
    const prefix=`${year}-${month}`;
    return records.filter(record=>record.date.startsWith(prefix));
  }
  if(analysisRange==='day'){
    return selectedCalendarDate?records.filter(record=>record.date===selectedCalendarDate):[];
  }
  if(analysisRange==='all')return records.slice();
  const todayOrdinal=Date.parse(`${calendarToday}T00:00:00Z`);
  const rangeDays=analysisRange==='7d'?7:30;
  const startOrdinal=todayOrdinal-(rangeDays-1)*86400000;
  return records.filter(record=>{
    const ordinal=Date.parse(`${record.date}T00:00:00Z`);
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
function showStrategyTrades(group,periodLabel){
  const dialog=document.getElementById('strategyTradesDialog');
  document.getElementById('strategyTradesTitle').textContent=group.name;
  const summary=document.getElementById('strategyTradesSummary');
  const list=document.getElementById('strategyTradesList');
  const range=document.getElementById('strategyTradesRange');
  const filters=[...dialog.querySelectorAll('[data-strategy-outcome]')];
  const strategyKey=(group.trades[0]?.strategy||'').trim().toLocaleLowerCase();
  const allRecords=trades.filter(trade=>(trade.strategy||'').trim().toLocaleLowerCase()===strategyKey);
  const node=(tag,className,text='')=>{
    const element=document.createElement(tag);
    element.className=className;
    element.textContent=text;
    return element;
  };
  const tone=value=>value>0?'green':value<0?'red':'';
  const monthLabel=month=>new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
  range.replaceChildren();
  [['period',periodLabel],['all','All time'],...[...new Set(allRecords.map(trade=>trade.date.slice(0,7)))].sort().reverse().map(month=>[month,monthLabel(month)])].forEach(([value,label])=>{
    const option=node('option','',label);
    option.value=value;
    range.append(option);
  });
  range.value='period';
  let outcome='ALL';
  const render=()=>{
    const items=range.value==='period'?group.trades:range.value==='all'?allRecords:allRecords.filter(trade=>trade.date.startsWith(range.value));
    const currencies=[...new Set(items.map(trade=>trade.currency||'USD'))].sort();
    const label=range.value==='period'?periodLabel:range.value==='all'?'All time':monthLabel(range.value);
    document.getElementById('strategyTradesPeriod').textContent=`${label} · ${items.length} ${items.length===1?'trade':'trades'} · ${currencies.join(' / ')||'no currencies'}`;
    summary.replaceChildren();
    const card=label=>{
      const cell=node('div','strategy-summary-cell');
      cell.append(node('span','strategy-summary-label',label));
      summary.append(cell);
      return cell;
    };
    const net=card('NET P&L');
    [...currencyTotals(items)].sort(([a],[b])=>a.localeCompare(b)).forEach(([currency,total])=>{
      net.append(node('strong',tone(total),formatPnl(total,currency)));
    });
    const wins=items.filter(trade=>trade.outcome==='WIN').length;
    const losses=items.filter(trade=>trade.outcome==='LOSS').length;
    const breakeven=items.filter(trade=>trade.outcome==='BREAKEVEN').length;
    net.append(node('small','',`${wins} W · ${losses} L${breakeven?` · ${breakeven} BE`:''}`));
    const rate=card('WIN RATE');
    rate.append(node('strong','',wins+losses?`${Math.round(wins/(wins+losses)*100)}%`:'—'));
    const bar=node('div','strategy-win-bar');
    const win=node('i','');
    const loss=node('i','');
    win.style.flex=String(wins);
    loss.style.flex=String(losses);
    bar.append(win,loss);
    bar.setAttribute('aria-hidden','true');
    rate.append(bar);
    const averages=card('AVG WIN / LOSS');
    currencies.forEach(currency=>{
      const stats=calculatePerformanceStats(items.filter(trade=>(trade.currency||'USD')===currency));
      const values=node('strong','strategy-average-values');
      values.append(node('span','green',stats.averageWin===null?'—':formatPnl(stats.averageWin,currency)),node('span','red',stats.averageLoss===null?'—':formatPnl(stats.averageLoss,currency)));
      averages.append(values,node('small','',`Reward:risk ${stats.averageWin!==null&&stats.averageLoss!==null?(stats.averageWin/Math.abs(stats.averageLoss)).toFixed(2):'—'}`));
    });
    const adherence=planAdherence(items);
    const plan=card('PLAN FOLLOWED');
    plan.append(node('strong','',adherence.known?`${adherence.followed} of ${adherence.known}`:'—'));
    plan.append(node('small','',`${adherence.known?`${Math.round(adherence.followed/adherence.known*100)}%`:'No saved status'}${adherence.unknown?` · ${adherence.unknown} unknown`:''}`));
    filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.strategyOutcome===outcome)));
    list.replaceChildren();
    const visible=items.filter(trade=>outcome==='ALL'||trade.outcome===outcome).slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.tradeTime||'').localeCompare(a.tradeTime||'')||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    const days=new Map();
    visible.forEach(trade=>{
      if(!days.has(trade.date))days.set(trade.date,[]);
      days.get(trade.date).push(trade);
    });
    days.forEach((records,date)=>{
      const day=node('div','strategy-trade-day');
      day.append(node('span','',new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).toUpperCase()));
      const totals=node('div','strategy-day-totals');
      [...currencyTotals(records)].sort(([a],[b])=>a.localeCompare(b)).forEach(([currency,value])=>totals.append(node('b',tone(value),formatPnl(value,currency))));
      day.append(totals);
      list.append(day);
      records.forEach(trade=>{
        const value=Number(trade.pnl||0);
        const record=node('button',`strategy-trade-record${value>0?' is-win':value<0?' is-loss':''}`);
        record.type='button';
        record.setAttribute('aria-label',`View all records for ${trade.date}: ${trade.instrument||'Trade'}`);
        const heading=node('span','strategy-trade-heading');
        heading.append(node('strong','',trade.instrument||'Trade'));
        if(trade.side)heading.append(node('span',`strategy-trade-side${trade.side==='SELL'?' is-sell':''}`,trade.side));
        heading.append(node('span',`strategy-trade-outcome ${trade.outcome==='WIN'?'green':trade.outcome==='LOSS'?'red':''}`,trade.outcome==='BREAKEVEN'?'BREAK-EVEN':trade.outcome));
        record.append(heading,node('span',`strategy-trade-amount ${tone(value)}`,formatPnl(value,trade.currency||'USD')),node('span','strategy-trade-chevron','›'));
        record.append(node('span','strategy-trade-meta',[trade.tradeTime,trade.account,trade.session].filter(Boolean).join(' · ')));
        if(trade.notes)record.append(node('span','strategy-trade-notes',trade.notes));
        record.addEventListener('click',()=>{
          const [year,month]=trade.date.split('-').map(Number);
          current.setFullYear(year,month-1,1);
          dialog.close();
          renderCalendar();
          showDay(trade.date,trades.filter(item=>item.date===trade.date));
          selected.scrollIntoView({behavior:'smooth',block:'start'});
        });
        list.append(record);
      });
    });
    if(!visible.length)list.append(node('p','analysis-empty','No trades match these filters.'));
    list.scrollTop=0;
  };
  range.onchange=render;
  filters.forEach(button=>{
    button.onclick=()=>{
      outcome=button.dataset.strategyOutcome;
      render();
    };
  });
  render();
  dialog.showModal();
}
function renderStrategyAnalysis(items,periodLabel){
  const groups=new Map();
  items.forEach(trade=>{
    const name=(trade.strategy||'').trim();
    const key=name?name.toLocaleLowerCase():null;
    if(!groups.has(key))groups.set(key,{name:name||'No strategy',wins:0,losses:0,breakeven:0,trades:[]});
    const group=groups.get(key);
    group.trades.push(trade);
    if(trade.outcome==='WIN')group.wins++;
    else if(trade.outcome==='LOSS')group.losses++;
    else if(trade.outcome==='BREAKEVEN')group.breakeven++;
  });
  const container=document.getElementById('strategyAnalysis');
  document.getElementById('strategyAnalysisCaption').textContent=periodLabel;
  container.replaceChildren();
  if(!groups.size){
    const empty=document.createElement('p');
    empty.className='analysis-empty';
    empty.textContent='No trades in this period.';
    container.append(empty);
    return;
  }
  [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)).forEach(group=>{
    const row=document.createElement('button');
    row.type='button';
    row.className='strategy-analysis-row';
    const name=document.createElement('strong');
    name.textContent=group.name;
    const detail=document.createElement('span');
    detail.textContent=`${group.wins} wins · ${group.losses} losses · ${group.breakeven} break-even`;
    const rate=document.createElement('strong');
    const decisive=group.wins+group.losses;
    rate.textContent=decisive?`${Math.round(group.wins/decisive*100)}%`:'—';
    rate.setAttribute('aria-label',decisive?`${rate.textContent} win rate`:'Win rate unavailable');
    row.append(name,detail,rate);
    row.addEventListener('click',()=>showStrategyTrades(group,periodLabel));
    container.append(row);
  });
}
function renderAnalysis(){
  const items=getAnalysisRecords(trades);
  analysisNoSetupCount.textContent=String(getAnalysisRecords(noSetupEntries).length);
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
  const adherence=planAdherence(items);
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
  analysisPlanRate.textContent=adherence.known?`${Math.round(adherence.followed/adherence.known*100)}%`:'—';
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
    analysisRange==='day'?(selectedCalendarDate?`Selected day · ${selectedCalendarDate}`:'Select a day on the calendar'):
      analysisRange==='7d'?'Last 7 days':analysisRange==='30d'?'Last 30 days':'All recorded trades';
  analysisPeriodLabel.textContent=rangeLabel;
  renderStrategyAnalysis(items,rangeLabel);
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
function planAdherence(items){
  const known=items.filter(trade=>typeof trade.followedPlan==='boolean');
  return{
    followed:known.filter(trade=>trade.followedPlan).length,
    known:known.length,
    unknown:items.length-known.length
  };
}
function showDay(date,items){
  selectedCalendarDate=date;
  if(analysisRange==='day')renderAnalysis();
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
  const noSetups=noSetupEntries.filter(entry=>entry.date===date);
  if(!items.length&&!noSetups.length){
    selected.append(make('p','day-records-empty','No trades on this date.'));
    return;
  }
  const wins=items.filter(trade=>trade.outcome==='WIN').length;
  const losses=items.filter(trade=>trade.outcome==='LOSS').length;
  const breakeven=items.length-wins-losses;
  const adherence=planAdherence(items);
  const totals=currencyTotals(items);
  const net=[...totals.values()].reduce((sum,value)=>sum+value,0);
  const stats=make('div','day-records-stats');
  const stat=(label,value,tone)=>{
    const box=make('div','day-records-stat');
    const strong=make('strong',tone||'',value);
    box.append(make('span','',label),strong);
    stats.append(box);
  };
  if(items.length){
    stat('Trades',String(items.length));
    const outcomes=make('div','day-records-stat');
    const outcomeCounts=make('strong','');
    outcomeCounts.append(make('i','green',String(wins)), ' / ', make('i','red',String(losses)), ` / ${breakeven}`);
    outcomes.append(make('span','','W / L / BE'),outcomeCounts);
    stats.append(outcomes);
    stat('Plan followed',adherence.known?`${adherence.followed} of ${adherence.known}${adherence.unknown?` · ${adherence.unknown} unknown`:''}`:'Not recorded',adherence.known&&adherence.followed===adherence.known?'green':'amber');
    const pnlStat=make('div','day-records-stat day-records-pnl');
    pnlStat.append(make('span','','Day P&L'),make('strong',totals.size===1?(net>0?'green':net<0?'red':''):'',formatTotals(totals)));
    stats.append(pnlStat);
  }else{
    stat('Trades','0');
    stat('P&L','0 · no trade');
  }
  header.append(stats);
  const list=make('div','day-records-grid');
  noSetups.forEach((entry,index)=>{
    const record=make('article','calendar-record record-card record-even record-no-setup');
    record.setAttribute('aria-label',`No-setup entry ${index+1}`);
    const caption=make('div','record-caption');
    caption.append(make('span','record-number',`NO-SETUP ENTRY ${String(index+1).padStart(2,'0')}`));
    record.append(caption);
    record.append(make('strong','','NO SETUP PRESENTED'));
    record.append(make('p','calendar-record-notes','No trade recorded for this entry.'));
    if(entry.notes)record.append(make('p','calendar-record-notes no-setup-notes',entry.notes));
    const actions=make('div','no-setup-calendar-actions');
    const edit=make('details','no-setup-calendar-edit');
    edit.append(make('summary','','EDIT ENTRY'));
    const form=document.createElement('form');
    form.method='post';
    form.action=`/no-setup/${encodeURIComponent(entry.id)}/edit`;
    form.className='journal-form';
    const csrf=document.createElement('input');
    csrf.type='hidden';
    csrf.name='_csrf';
    csrf.value=grid.dataset.csrf;
    const returnTo=document.createElement('input');
    returnTo.type='hidden';
    returnTo.name='returnTo';
    returnTo.value='calendar';
    const returnDate=document.createElement('input');
    returnDate.type='hidden';
    returnDate.name='returnDate';
    returnDate.value=entry.date;
    const dateLabel=make('label','','DATE');
    const dateInput=document.createElement('input');
    dateInput.type='date';
    dateInput.name='date';
    dateInput.value=entry.date;
    dateInput.required=true;
    dateLabel.append(dateInput);
    const notesLabel=make('label','','NOTES (OPTIONAL)');
    const notesInput=document.createElement('textarea');
    notesInput.name='notes';
    notesInput.maxLength=3000;
    notesInput.rows=3;
    notesInput.value=entry.notes||'';
    notesLabel.append(notesInput);
    const save=make('button','outline','SAVE CHANGES');
    save.type='submit';
    dateInput.addEventListener('change',()=>{returnDate.value=dateInput.value});
    form.append(csrf,returnTo,returnDate,dateLabel,notesLabel,save);
    edit.append(form);
    const deleteForm=document.createElement('form');
    deleteForm.method='post';
    deleteForm.action=`/no-setup/${encodeURIComponent(entry.id)}/delete`;
    deleteForm.addEventListener('submit',event=>{
      if(!window.confirm('Delete this no-setup entry?'))event.preventDefault();
    });
    const deleteCsrf=document.createElement('input');
    deleteCsrf.type='hidden';
    deleteCsrf.name='_csrf';
    deleteCsrf.value=grid.dataset.csrf;
    const deleteReturnTo=document.createElement('input');
    deleteReturnTo.type='hidden';
    deleteReturnTo.name='returnTo';
    deleteReturnTo.value='calendar';
    const deleteReturnDate=document.createElement('input');
    deleteReturnDate.type='hidden';
    deleteReturnDate.name='returnDate';
    deleteReturnDate.value=selectedCalendarDate||entry.date;
    const remove=make('button','textbutton danger-text','DELETE');
    remove.type='submit';
    deleteForm.append(deleteCsrf,deleteReturnTo,deleteReturnDate,remove);
    actions.append(edit,deleteForm);
    record.append(actions);
    list.append(record);
  });
  const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:calendarTimezone,hour:'2-digit',minute:'2-digit'});
  const money=(value,currency)=>new Intl.NumberFormat('en-US',{
    style:'currency',currency:currency||'USD',currencyDisplay:'narrowSymbol',
    signDisplay:'exceptZero',minimumFractionDigits:2,maximumFractionDigits:2
  }).format(value);
  items.forEach((trade,index)=>{
    const outcome=trade.outcome||'BREAKEVEN';
    const tone=outcome==='WIN'?'win':outcome==='LOSS'?'loss':'even';
    const record=make('article',`calendar-record record-card record-${tone}`);
    record.setAttribute('aria-label',`Trade ${index+1}: ${trade.instrument||'Trade'}`);
    const caption=make('div','record-caption');
    caption.append(make('span','record-number',`TRADE ${String(index+1).padStart(2,'0')}`));
    if(trade.tradeTime||trade.createdAt){
      caption.append(make('span','record-time',`${trade.tradeTime||timeFormat.format(new Date(trade.createdAt))} · ${calendarTimezone}`));
    }
    record.append(caption);
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
      make('strong',amount>0?'green':amount<0?'red':'',money(amount,trade.currency)),
      make('span','',trade.currency||'USD')
    );
    head.append(identity,pnl);
    record.append(head);
    const meta=make('div','record-meta');
    if(trade.session)meta.append(make('span','',`Session: ${trade.session}`));
    const accountCount=Math.max(1,Number(trade.accountCount)||1);
    const account=make('span','record-account');
    if(trade.account)account.append(make('b','',trade.account),' · ');
    account.append(`${accountCount}× ${accountCount===1?'account':'accounts'} `,
      make('span','record-account-each',`(≈ ${money(amount/accountCount,trade.currency)} each)`));
    meta.append(account);
    const strategy=make('span','record-strategy');
    strategy.append('Strategy: ',make('b','',trade.strategy||'No strategy'));
    meta.append(strategy);
    record.append(meta);
    const chips=make('div','record-chips');
    const emotion=trade.emotion||'calm';
    chips.append(make('span',`record-chip ${emotion==='calm'?'':'record-chip-warn'}`,emotion.toUpperCase()));
    const planStatus=trade.followedPlan===true?'PLAN FOLLOWED':trade.followedPlan===false?'PLAN BROKEN':'PLAN STATUS UNKNOWN';
    const planClass=trade.followedPlan===true?'record-chip-good':trade.followedPlan===false?'record-chip-bad':'';
    chips.append(make('span',`record-chip ${planClass}`,planStatus));
    if(trade.checklistCompleted===true)chips.append(make('span','record-chip','CHECKLIST COMPLETED'));
    else if(trade.checklistCompleted===false)chips.append(make('span','record-chip record-chip-bad','CHECKLIST MISSED'));
    record.append(chips);
    const recordImages=make('div','record-images');
    (trade.images||[]).forEach((imageId,index)=>{
      const imageButton=make('button','image-preview-trigger record-image');
      imageButton.type='button';
      imageButton.dataset.imageSrc=`/trades/${encodeURIComponent(trade.id)}/images/${encodeURIComponent(imageId)}`;
      imageButton.setAttribute('aria-label',`Preview image ${index+1} for ${trade.instrument||'trade'}`);
      const image=document.createElement('img');
      image.src=imageButton.dataset.imageSrc;
      image.alt=`Trade attachment ${index+1}`;
      image.loading='lazy';
      imageButton.append(image,make('span','record-image-enlarge','⤢ ENLARGE'));
      bindImagePreview(imageButton);
      recordImages.append(imageButton);
    });
    if(trade.tradingViewId){
      const snapshotButton=createTradingViewPreviewButton(trade.tradingViewId,`Preview TradingView snapshot for ${trade.instrument||'trade'}`);
      if(snapshotButton){
        snapshotButton.classList.add('record-image');
        snapshotButton.append(make('span','record-image-enlarge','⤢ ENLARGE'));
        recordImages.append(snapshotButton);
      }
    }
    if(recordImages.childElementCount)record.append(recordImages);
    const appendNote=(label,text,warning)=>{
      if(!text)return;
      const note=make('div',`record-note${warning?' record-note-warning':''}`);
      const content=make('p','record-note-text',text);
      note.append(make('span','record-label',label),content);
      if(text.length>180||text.split('\n').length>3){
        const more=make('button','record-note-more','SHOW MORE');
        more.type='button';
        more.setAttribute('aria-expanded','false');
        more.addEventListener('click',()=>{
          const expanded=more.getAttribute('aria-expanded')!=='true';
          more.setAttribute('aria-expanded',String(expanded));
          content.classList.toggle('is-expanded',expanded);
          more.textContent=expanded?'SHOW LESS':'SHOW MORE';
        });
        note.append(more);
      }else content.classList.toggle('is-expanded',true);
      record.append(note);
    };
    appendNote('WHY THE PLAN BROKE',trade.planDeviationReason,true);
    appendNote('NOTES',trade.notes,false);
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
    const returnTo=document.createElement('input');
    returnTo.type='hidden';
    returnTo.name='returnTo';
    returnTo.value='calendar';
    const returnDate=document.createElement('input');
    returnDate.type='hidden';
    returnDate.name='returnDate';
    returnDate.value=selectedCalendarDate||trade.date;
    const remove=make('button','textbutton danger-text','DELETE');
    remove.type='submit';
    remove.setAttribute('aria-label',`Delete ${trade.instrument||'trade'} record`);
    deleteForm.append(csrf,returnTo,returnDate,remove);
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
function renderMonthTradeList(items){
  const section=document.getElementById('calendarMonthTrades');
  section.hidden=!monthTradesExpanded;
  const rows=document.getElementById('calendarMonthTradeRows');
  rows.replaceChildren();
  if(!monthTradesExpanded)return;
  document.getElementById('calendarMonthTradesTitle').textContent=`${title.textContent} · ${selectedCalendarCurrency} · ${items.length} ${items.length===1?'trade':'trades'}`;
  if(!items.length){
    const row=document.createElement('tr');
    const cell=document.createElement('td');
    cell.colSpan=6;
    cell.textContent='No trades recorded for this month and currency.';
    row.append(cell);
    rows.append(row);
    return;
  }
  const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:calendarTimezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const timeOf=trade=>trade.tradeTime||(trade.createdAt?timeFormat.format(new Date(trade.createdAt)):'');
  const chronological=items.slice().sort((a,b)=>
    b.date.localeCompare(a.date)||timeOf(b).localeCompare(timeOf(a))
  );
  chronological.forEach(trade=>{
    const row=document.createElement('tr');
    const dateCell=document.createElement('th');
    dateCell.scope='row';
    const open=document.createElement('button');
    open.type='button';
    open.className='calendar-table-link';
    const time=timeOf(trade);
    open.textContent=`${trade.date}${time?` · ${time}`:''}`;
    open.setAttribute('aria-label',`View ${trade.instrument||'trade'} records for ${trade.date}`);
    open.addEventListener('click',()=>{
      showDay(trade.date,trades.filter(item=>item.date===trade.date));
      selected.scrollIntoView({behavior:'smooth',block:'start'});
    });
    dateCell.append(open);
    row.append(dateCell);
    [trade.instrument||'—',trade.side||'—',trade.strategy||'—',trade.outcome,calendarMoney(trade.pnl)].forEach((value,index)=>{
      const cell=document.createElement('td');
      cell.textContent=value;
      if(index===4)cell.className=calendarTone(trade.pnl);
      row.append(cell);
    });
    rows.append(row);
  });
}
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
  const monthPrefix=`${year}-${String(month+1).padStart(2,'0')}-`;
  const monthNoSetup=noSetupEntries.filter(entry=>entry.date.startsWith(monthPrefix));
  const monthValue=calendarNet(monthTrades);
  const daily=new Map();
  monthTrades.forEach(trade=>{
    const records=daily.get(trade.date)||[];
    records.push(trade);
    daily.set(trade.date,records);
  });
  title.textContent=current.toLocaleString('en-US',{month:'long',year:'numeric'});
  const years=[...new Set([calendarYear-1,calendarYear,year,...trades.map(trade=>Number(trade.date.slice(0,4))),...noSetupEntries.map(entry=>Number(entry.date.slice(0,4)))])].sort((a,b)=>a-b);
  const yearButtons=document.getElementById('calendarYears');
  const tableYear=document.getElementById('calendarTableYear');
  yearButtons.replaceChildren();
  tableYear.replaceChildren();
  years.forEach(value=>{
    const option=document.createElement('option');
    option.value=String(value);
    option.textContent=String(value);
    tableYear.append(option);
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
  tableYear.value=String(year);
  tableYear.onchange=()=>{
    current.setFullYear(Number(tableYear.value));
    renderCalendar();
  };
  const profitableMonths=months.filter(entry=>entry.records.length&&entry.value>0).length;
  const recordedMonths=months.filter(entry=>entry.records.length).length;
  document.getElementById('calendarYearCaption').textContent=`${profitableMonths} of ${recordedMonths} recorded months profitable · ${selectedCalendarCurrency} · ${year}`;
  document.getElementById('calendarMonthTableCaption').textContent=`${year} · ${selectedCalendarCurrency} · Select a month to view its trades`;
  document.getElementById('calendarYearTrades').textContent=String(yearItems.length);
  document.getElementById('calendarYearWinRate').textContent=calendarWinRate(yearItems);
  const yearPnl=document.getElementById('calendarYearPnl');
  const yearValue=calendarNet(yearItems);
  yearPnl.textContent=yearItems.length?calendarMoney(yearValue):'—';
  yearPnl.className=calendarTone(yearValue);
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
    row.className=monthTradesExpanded&&index===month?'is-selected':'';
    row.addEventListener('click',()=>{
      current.setMonth(index,1);
      monthTradesExpanded=true;
      renderCalendar();
      monthRows.children[index].children[0].children[0].focus();
    });
    [entry.label,String(entry.records.length),calendarWinRate(entry.records),entry.records.length?calendarMoney(entry.value):'—'].forEach((text,column)=>{
      const cell=document.createElement(column===0?'th':'td');
      if(column===0){
        cell.scope='row';
        const open=document.createElement('button');
        open.type='button';
        open.className='calendar-table-link';
        open.textContent=new Date(year,index,1).toLocaleString('en-US',{month:'long',year:'numeric'});
        open.setAttribute('aria-expanded',String(monthTradesExpanded&&index===month));
        open.setAttribute('aria-controls','calendarMonthTrades');
        cell.append(open);
      }else cell.textContent=text;
      if(column===3)cell.className=calendarTone(entry.value);
      row.append(cell);
    });
    monthRows.append(row);
  });
  renderMonthTradeList(monthTrades);
  monthPnl.textContent=calendarMoney(monthValue);
  monthPnl.className=`month-pnl ${calendarTone(monthValue)}`;
  document.getElementById('calendarMonthCurrency').textContent=selectedCalendarCurrency;
  const wins=monthTrades.filter(trade=>trade.outcome==='WIN').length;
  const losses=monthTrades.filter(trade=>trade.outcome==='LOSS').length;
  const stats=document.getElementById('calendarMonthStats');
  stats.replaceChildren();
  const dailyResults=[...daily].map(([date,records])=>({date,value:calendarNet(records)}));
  const best=dailyResults.reduce((result,day)=>!result||day.value>result.value?day:result,null);
  const worst=dailyResults.reduce((result,day)=>!result||day.value<result.value?day:result,null);
  const chronological=monthTrades.slice().sort((a,b)=>
    String(a.createdAt||a.date).localeCompare(String(b.createdAt||b.date))||String(a.id||'').localeCompare(String(b.id||''))
  );
  let streakType='',streakLength=0,bestWinStreak=0,worstLossStreak=0;
  chronological.forEach(trade=>{
    const outcome=trade.outcome==='WIN'||trade.outcome==='LOSS'?trade.outcome:'';
    if(outcome&&outcome===streakType)streakLength++;
    else{
      streakType=outcome;
      streakLength=outcome?1:0;
    }
    if(outcome==='WIN')bestWinStreak=Math.max(bestWinStreak,streakLength);
    if(outcome==='LOSS')worstLossStreak=Math.max(worstLossStreak,streakLength);
  });
  const currentWinStreak=streakType==='WIN'?streakLength:0;
  const currentLossStreak=streakType==='LOSS'?streakLength:0;
  const formatDay=date=>{
    const parts=new Intl.DateTimeFormat('en-US',{weekday:'short',day:'numeric',month:'short'}).formatToParts(new Date(`${date}T12:00:00`));
    const value=type=>parts.find(part=>part.type===type)?.value||'';
    return`${value('weekday')} ${value('day')} ${value('month')}`;
  };
  const statValues=[
    ['TRADES',String(monthTrades.length)],
    ['WIN RATE',calendarWinRate(monthTrades)],
    ['BEST DAY',best?calendarMoney(best.value):'—',best?.value,best?formatDay(best.date):'No recorded days'],
    ['WORST DAY',worst?calendarMoney(worst.value):'—',worst?.value,worst?formatDay(worst.date):'No recorded days'],
    ['WINS',String(wins),'positive'],
    ['LOSSES',String(losses),'negative'],
    ['BEST WIN STREAK',`${bestWinStreak} ${bestWinStreak===1?'trade':'trades'}`,'positive',`Current · ${currentWinStreak} ${currentWinStreak===1?'trade':'trades'}`],
    ['WORST LOSS STREAK',`${worstLossStreak} ${worstLossStreak===1?'trade':'trades'}`,'negative',`Current · ${currentLossStreak} ${currentLossStreak===1?'trade':'trades'}`]
  ];
  statValues.forEach(([label,value,tone,detail])=>{
    const cell=document.createElement('div');
    const name=document.createElement('span');
    name.textContent=label;
    const result=document.createElement('strong');
    result.textContent=value;
    if(tone!==undefined)result.className=typeof tone==='string'?tone:calendarTone(tone);
    cell.append(name,result);
    if(detail){
      const note=document.createElement('small');
      note.textContent=detail;
      cell.append(note);
    }
    stats.append(cell);
  });
  grid.replaceChildren();
  const noSetupDates=new Set(monthNoSetup.map(entry=>entry.date));
  const showWeekends=[...monthTrades,...monthNoSetup].some(entry=>[0,6].includes(new Date(`${entry.date}T12:00:00Z`).getUTCDay()));
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
      const noSetup=noSetupDates.has(date);
      const value=calendarNet(dayTrades);
      weekTrades.push(...dayTrades);
      const button=document.createElement('button');
      button.type='button';
      button.dataset.date=date;
      button.className=`day${dayTrades.length?` ${calendarTone(value)}`:noSetup?' neutral':''}${date===calendarToday?' is-today':''}${date===selectedCalendarDate?' is-selected':''}`;
      button.setAttribute('aria-pressed',String(date===selectedCalendarDate));
      button.setAttribute('aria-label',`${date}: ${dayTrades.length} ${selectedCalendarCurrency} trades${dayTrades.length?`, ${calendarMoney(value)}`:noSetup?', zero selected-currency P&L':''}${noSetup?', no setup presented':''}. Open records for this date.`);
      const number=document.createElement('span');
      number.className='calendar-day-number';
      number.textContent=day;
      const pnl=document.createElement('strong');
      pnl.className=`calendar-day-pnl${dayTrades.length||noSetup?'':' is-empty'}`;
      pnl.textContent=dayTrades.length?calendarMoney(value):noSetup?'0 · NO SETUP':'—';
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
      if(noSetup){
        const label=document.createElement('small');
        label.className='calendar-no-setup';
        label.textContent='NO SETUP';
        button.append(label);
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
if(validRequestedCalendarDate)showDay(requestedCalendarDate,trades.filter(trade=>trade.date===requestedCalendarDate));
})();
