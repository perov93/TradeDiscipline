const sessions=[
  {name:'Sydney',timezone:'Australia/Sydney',open:8,close:17},
  {name:'Tokyo',timezone:'Asia/Tokyo',open:9,close:18},
  {name:'London',timezone:'Europe/London',open:8,close:17},
  {name:'New York',timezone:'America/New_York',open:8,close:17}
];
const SESSION_CHOICES=[
  'auto','Sydney','Sydney / Tokyo','Tokyo','Tokyo / London','London',
  'London / New York','New York','Off-session'
];
const formatters=new Map(sessions.map(session=>[session.name,new Intl.DateTimeFormat('en-US',{
  timeZone:session.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
})]));

function tradingSessionAt(date){
  const active=sessions.filter(session=>{
    const parts=Object.fromEntries(formatters.get(session.name).formatToParts(date).map(part=>[part.type,part.value]));
    const minuteOfDay=Number(parts.hour)*60+Number(parts.minute);
    return ['Mon','Tue','Wed','Thu','Fri'].includes(parts.weekday)&&
      minuteOfDay>=session.open*60&&minuteOfDay<session.close*60;
  }).map(session=>session.name);
  return active.length?active.join(' / '):'Off-session';
}

function resolveTradingSession(choice,date){
  if(choice==='auto')return tradingSessionAt(date);
  return SESSION_CHOICES.includes(choice)?choice:null;
}

module.exports={SESSION_CHOICES,tradingSessionAt,resolveTradingSession};
