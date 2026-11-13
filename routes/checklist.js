const express=require('express');

module.exports=function checklistRoutes({User,auth,stateFor}){
  const router=express.Router();
  router.post('/reset',auth,async(req,res,next)=>{
    try{
      const user=await User.findById(req.session.user.id);
      if(!user)return res.sendStatus(401);
      const state=await stateFor(user);
      state.checks=[];
      state.checkTime=null;
      await state.save();
      req.session.success='Checklist reset. Complete it again before your next trade.';
      res.redirect('/#trade');
    }catch(error){next(error)}
  });
  return router;
};
