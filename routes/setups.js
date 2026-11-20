const express=require('express');
const path=require('path');
const {SESSION_CHOICES,resolveTradingSession}=require('../lib/market-sessions');
const {tradingViewSnapshotId}=require('../lib/tradingview');

module.exports=function setupRoutes({SetupExample,auth,validId,receiveTradeImages,requestImages,
  discardRequestImages,removeStoredImage,storedTradeImages,imageType,imageDirectory,maxTradeImages,
  requestVideos=()=>[],storedTradeVideos=()=>[],videoType=()=>'',maxTradeVideos=3,
  validTradeTime}){
  const router=express.Router();
  router.use(auth);

  async function save(req,res,next){
    let committed=false;
    try{
      const existing=req.params.id
        ? validId(req.params.id)&&await SetupExample.findOne({_id:req.params.id,user:req.session.user.id})
        : null;
      if(req.params.id&&!existing){
        await discardRequestImages(req);
        return res.sendStatus(404);
      }
      const body=req.body;
      const text=(key)=>typeof body[key]==='string'?body[key].trim():'';
      const title=text('title'),instrument=text('instrument'),
        strategy=text('strategy'),notes=text('notes'),
        currency=text('currency').toUpperCase(),tradeTime=text('tradeTime'),
        outcome=text('outcome'),side=text('side'),session=text('session'),
        tradingViewId=tradingViewSnapshotId(body.tradingViewUrl||'');
      let error='';
      if(!title||title.length>140)error='Enter a setup name of up to 140 characters.';
      else if(instrument.length>40||strategy.length>120||notes.length>3000)error='One or more fields exceed their maximum length.';
      else if(!SESSION_CHOICES.includes(session))error='Choose a valid trading session.';
      else if(!validTradeTime(tradeTime))error='Enter a valid trade time.';
      else if(!['','BUY','SELL'].includes(side))error='Choose a valid direction.';
      else if(!['WIN','LOSS','BREAKEVEN'].includes(outcome))error='Choose a trade result.';
      else if(!/^[A-Z]{3}$/.test(currency))error='Enter a three-letter currency code.';
      else if(tradingViewId===null)error='Enter a valid public TradingView snapshot link.';
      const uploaded=requestImages(req).map(file=>({id:file.filename,mime:imageType(file)}));
      if(!error&&uploaded.some(image=>!image.mime))error='The selected file is not a supported JPEG, PNG, or WebP image.';
      const videoFiles=requestVideos(req),
        uploadedVideos=videoFiles.map(file=>({id:file.filename,mime:videoType(file)}));
      if(!error&&uploadedVideos.some((video,index)=>!video.mime||video.mime!==videoFiles[index].mimetype))error='The selected file is not a supported MP4 or WebM video.';
      const previous=storedTradeImages(existing);
      const removals=new Set([].concat(body.removeImages||[]).filter(id=>typeof id==='string'));
      const retained=previous.filter(image=>!removals.has(image.id));
      if(!error&&retained.length+uploaded.length>maxTradeImages)error=`An example can have up to ${maxTradeImages} images.`;
      const previousVideos=storedTradeVideos(existing);
      const videoRemovals=new Set([].concat(body.removeVideos||[]).filter(id=>typeof id==='string'));
      const retainedVideos=previousVideos.filter(video=>!videoRemovals.has(video.id));
      if(!error&&retainedVideos.length+uploadedVideos.length>maxTradeVideos)error=`An example can have up to ${maxTradeVideos} videos.`;
      if(error){
        await discardRequestImages(req);
        return res.status(400).send(error);
      }
      const values={title,session:resolveTradingSession(session,new Date()),
        tradeTime,instrument,side,outcome,currency,strategy,notes,tradingViewId,
        images:[...retained,...uploaded],videos:[...retainedVideos,...uploadedVideos],imageId:'',imageMime:''};
      if(existing){
        Object.assign(existing,values);
        await existing.save();
      }else await SetupExample.create({...values,user:req.session.user.id,
        accountCount:null,pnl:null,emotion:null,followedPlan:null});
      committed=true;
      for(const image of previous.filter(image=>removals.has(image.id)))await removeStoredImage(image.id);
      for(const video of previousVideos.filter(video=>videoRemovals.has(video.id)))await removeStoredImage(video.id);
      req.session.success=existing?'Setup example updated.':'Setup example saved.';
      res.redirect('/#setups');
    }catch(error){
      if(!committed&&(requestImages(req).length||requestVideos(req).length))await discardRequestImages(req).catch(cleanupError=>console.error('Unable to remove rejected setup uploads:',cleanupError));
      next(error);
    }
  }
  router.post('/',receiveTradeImages,save);
  router.post('/:id/edit',receiveTradeImages,save);
  router.get('/:id/images/:imageId',async(req,res,next)=>{
    try{
      if(!validId(req.params.id)||!/^[0-9a-f-]{36}$/i.test(req.params.imageId))return res.sendStatus(404);
      const example=await SetupExample.findOne({_id:req.params.id,user:req.session.user.id}).lean();
      const image=storedTradeImages(example).find(item=>item.id===req.params.imageId);
      if(!image||!image.mime)return res.sendStatus(404);
      res.set('Cache-Control','private, no-store');
      res.set('X-Content-Type-Options','nosniff');
      res.type(image.mime).sendFile(path.join(imageDirectory,image.id));
    }catch(error){next(error)}
  });
  router.get('/:id/videos/:videoId',async(req,res,next)=>{
    try{
      if(!validId(req.params.id)||!/^[0-9a-f-]{36}$/i.test(req.params.videoId))return res.sendStatus(404);
      const example=await SetupExample.findOne({_id:req.params.id,user:req.session.user.id}).lean();
      const video=storedTradeVideos(example).find(item=>item.id===req.params.videoId);
      if(!video||!video.mime)return res.sendStatus(404);
      res.set('Cache-Control','private, no-store');
      res.set('X-Content-Type-Options','nosniff');
      res.type(video.mime).sendFile(path.join(imageDirectory,video.id));
    }catch(error){next(error)}
  });
  router.post('/:id/delete',async(req,res,next)=>{
    try{
      if(!validId(req.params.id))return res.sendStatus(404);
      const example=await SetupExample.findOneAndDelete({_id:req.params.id,user:req.session.user.id});
      if(!example)return res.sendStatus(404);
      for(const image of storedTradeImages(example))await removeStoredImage(image.id);
      for(const video of storedTradeVideos(example))await removeStoredImage(video.id);
      req.session.success='Setup example deleted.';
      res.redirect(req.body.returnTo==='setup-library'?'/setup-library':'/#setups');
    }catch(error){next(error)}
  });
  return router;
};
