function tradingViewSnapshotId(value){
  if(typeof value!=='string')return null;
  const input=value.trim();
  if(!input)return '';
  if(input.length>2048)return null;
  let url;
  try{
    url=new URL(input);
  }catch{
    return null;
  }
  if(url.protocol!=='https:'||url.hostname!=='www.tradingview.com'||url.port||url.username||url.password)return null;
  const match=url.pathname.match(/^\/x\/([a-z0-9]{8})\/?$/i);
  return match?match[1]:null;
}

module.exports={tradingViewSnapshotId};
