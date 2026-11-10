const DEFAULT_PREFERENCES=Object.freeze({
  defaultCurrency:'USD',calendarCurrency:'USD',analysisRange:'month',defaultTab:'trading',
  showWorldClocks:true,showForexHours:true,showNyReminder:true,showEconomicCalendar:true
});
const TABS=['trading','journal','calendar','rules','settings'];
const ANALYSIS_RANGES=['month','7d','30d','all'];
const TIMEZONES=['UTC',...Intl.supportedValuesOf('timeZone')];
const CURRENCIES=Intl.supportedValuesOf('currency');

function preferencesFor(user){
  return Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key,value])=>[key,user.preferences?.[key]??value]));
}
function validateSettings(body){
  const name=typeof body.name==='string'?body.name.trim():'';
  if(name.length<2||name.length>80)return{error:'Display name must be between 2 and 80 characters.'};
  const timezone=typeof body.timezone==='string'?body.timezone:'';
  try{
    if(!timezone||timezone.length>100)throw new RangeError();
    new Intl.DateTimeFormat('en-GB',{timeZone:timezone});
  }catch(error){
    if(!(error instanceof RangeError))throw error;
    return{error:'Choose a valid account timezone.'};
  }
  const limits={};
  for(const [key,max] of [['maxTrades',100],['maxLosses',100],['cooldownMinutes',240]]){
    const raw=body[key];
    const value=typeof raw==='string'&&/^\d+$/.test(raw)?Number(raw):NaN;
    if(!Number.isInteger(value)||value<1||value>max)return{error:`${key} must be a whole number between 1 and ${max}.`};
    limits[key]=value;
  }
  const preferences={};
  for(const key of ['defaultCurrency','calendarCurrency']){
    const value=typeof body[key]==='string'?body[key].trim().toUpperCase():'';
    if(!CURRENCIES.includes(value))return{error:'Choose a valid three-letter currency code.'};
    preferences[key]=value;
  }
  if(!TABS.includes(body.defaultTab)||!ANALYSIS_RANGES.includes(body.analysisRange))return{error:'Choose a valid default tab and analysis period.'};
  preferences.defaultTab=body.defaultTab;
  preferences.analysisRange=body.analysisRange;
  for(const key of ['showWorldClocks','showForexHours','showNyReminder','showEconomicCalendar']){
    if(body[key]!==undefined&&body[key]!=='on')return{error:'Invalid dashboard visibility option.'};
    preferences[key]=body[key]==='on';
  }
  return{value:{name,timezone,limits,preferences}};
}
function scheduleDiscipline(user,settings,effectiveAt){
  const changed=user.timezone!==settings.timezone||
    Object.keys(settings.limits).some(key=>user.limits[key]!==settings.limits[key]);
  return changed?{
    timezone:settings.timezone,limits:settings.limits,
    effectiveAt:user.pendingSettings?.effectiveAt||effectiveAt
  }:null;
}
async function applyPendingSettings(user,now=new Date()){
  if(!user.pendingSettings?.effectiveAt||user.pendingSettings.effectiveAt>now)return;
  user.timezone=user.pendingSettings.timezone;
  user.limits=user.pendingSettings.limits.toObject?user.pendingSettings.limits.toObject():user.pendingSettings.limits;
  user.pendingSettings=null;
  await user.save();
}
module.exports={DEFAULT_PREFERENCES,TABS,ANALYSIS_RANGES,TIMEZONES,CURRENCIES,preferencesFor,validateSettings,scheduleDiscipline,applyPendingSettings};
