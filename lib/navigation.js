function recordReturnTo(body){
  if(body.returnTo!=='calendar')return '/#journal';
  const date=body.returnDate;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return '/#calendar';
  const parsed=new Date(`${date}T00:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return '/#calendar';
  return `/?calendarDate=${date}#calendar`;
}

module.exports={recordReturnTo};
