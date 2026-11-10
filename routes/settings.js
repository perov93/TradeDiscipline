const express=require('express');
const bcrypt=require('bcryptjs');
const rateLimit=require('express-rate-limit');
const {validateSettings,scheduleDiscipline}=require('../lib/settings');

module.exports=function settingsRoutes({User,auth,stateFor,startOfNextDay}){
  const router=express.Router();
  router.use(auth);
  router.post('/',async(req,res,next)=>{
    try{
      const {value,error}=validateSettings(req.body);
      if(error){req.session.error=error;return res.redirect('/#settings')}
      const user=await User.findById(req.session.user.id);
      if(!user)return res.sendStatus(401);
      await stateFor(user);
      user.pendingSettings=scheduleDiscipline(user,value,startOfNextDay(new Date(),user.timezone));
      user.name=value.name;
      user.preferences=value.preferences;
      await user.save();
      req.session.user.name=user.name;
      req.session.success='Settings saved. Any pending discipline or timezone changes apply at the next account day.';
      res.redirect('/#settings');
    }catch(error){next(error)}
  });
  router.post('/password',rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res,next)=>{
    try{
      const {currentPassword,newPassword,confirmPassword}=req.body;
      if(typeof currentPassword!=='string'||typeof newPassword!=='string'||newPassword.length<10||newPassword.length>128||Buffer.byteLength(newPassword,'utf8')>72||newPassword!==confirmPassword){
        req.session.error='Enter your current password and matching new passwords (10-128 characters, at most 72 UTF-8 bytes).';
        return res.redirect('/#settings');
      }
      const user=await User.findById(req.session.user.id);
      if(!user)return res.sendStatus(401);
      if(!await bcrypt.compare(currentPassword,user.passwordHash)){
        req.session.error='Current password is incorrect.';
        return res.redirect('/#settings');
      }
      user.passwordHash=await bcrypt.hash(newPassword,12);
      await user.save();
      req.session.regenerate(error=>{
        if(error)return next(error);
        req.session.user={id:String(user._id),name:user.name};
        req.session.success='Password changed. Your current session has been renewed.';
        req.session.save(error=>error?next(error):res.redirect('/#settings'));
      });
    }catch(error){next(error)}
  });
  return router;
};
