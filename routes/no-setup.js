const express=require('express');
const {recordReturnTo}=require('../lib/navigation');

module.exports=function noSetupRoutes({NoSetup,auth,validId}){
  const router=express.Router();
  router.use(auth);
  const validate=body=>{
    const date=body.date;
    const notes=body.notes===undefined?'':body.notes;
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return {error:'Choose a valid date for the no-setup entry.'};
    const parsed=new Date(`${date}T00:00:00Z`);
    if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return {error:'Choose a valid date for the no-setup entry.'};
    if(typeof notes!=='string'||notes.length>3000)return {error:'Notes must be 3000 characters or fewer.'};
    return {date,notes:notes.trim()};
  };
  router.post('/',async(req,res,next)=>{
    try{
      const entry=validate(req.body);
      if(entry.error){req.session.error=entry.error;return res.redirect('/#journal')}
      await NoSetup.create({user:req.session.user.id,date:entry.date,notes:entry.notes});
      req.session.success='No-setup entry saved.';
      res.redirect('/#journal');
    }catch(error){next(error)}
  });
  router.post('/:id/edit',async(req,res,next)=>{
    try{
      if(!validId(req.params.id))return res.sendStatus(404);
      const entry=validate(req.body);
      if(entry.error){req.session.error=entry.error;return res.redirect(recordReturnTo(req.body))}
      const updated=await NoSetup.findOneAndUpdate({_id:req.params.id,user:req.session.user.id},{date:entry.date,notes:entry.notes},{runValidators:true});
      if(!updated)return res.sendStatus(404);
      req.session.success='No-setup entry updated.';
      res.redirect(recordReturnTo(req.body));
    }catch(error){next(error)}
  });
  router.post('/:id/delete',async(req,res,next)=>{
    try{
      if(!validId(req.params.id))return res.sendStatus(404);
      const deleted=await NoSetup.findOneAndDelete({_id:req.params.id,user:req.session.user.id});
      if(!deleted)return res.sendStatus(404);
      req.session.success='No-setup entry deleted.';
      res.redirect(recordReturnTo(req.body));
    }catch(error){next(error)}
  });
  return router;
};
