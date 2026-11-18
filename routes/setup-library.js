const express=require('express');

const PAGE_SIZE=20;
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const validDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<100)return false;
  const date=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
};

module.exports=function setupLibraryRoutes({SetupExample,Trade,User,auth,dayKey,timeKey,zonedTime,startOfNextDay}){
  const router=express.Router();
  router.use(auth);
  router.get('/',async(req,res,next)=>{
    try{
      const read=(name,max)=>{
        const value=req.query[name];
        if(value===undefined)return '';
        if(typeof value!=='string'||value.trim().length>max)throw new RangeError(`Invalid ${name} filter.`);
        return value.trim();
      };
      let search,strategy,instrument,type,outcome,pageText,from,to;
      try{
        search=read('search',120);
        strategy=read('strategy',120);
        instrument=read('instrument',40);
        type=read('type',10)||'all';
        outcome=read('outcome',10)||'all';
        pageText=read('page',8)||'1';
        from=read('from',10);
        to=read('to',10);
        if(!['all','example','trade'].includes(type)||!['all','WIN','LOSS','BREAKEVEN'].includes(outcome)||
          !/^[1-9]\d*$/.test(pageText))throw new RangeError('Invalid library filters or page.');
        if((from&&!validDate(from))||(to&&!validDate(to))||(to&&!from)||(from&&to&&to<from)){
          throw new RangeError('Choose a valid start date and an end date on or after it.');
        }
      }catch(error){
        if(error instanceof RangeError)return res.status(400).send(error.message);
        throw error;
      }
      const user=await User.findById(req.session.user.id);
      if(!user)return res.redirect('/login');
      const common={user:user._id};
      if(from){
        const endDate=to||from;
        common.createdAt={
          $gte:zonedTime(from,0,0,user.timezone),
          $lt:startOfNextDay(zonedTime(endDate,12,0,user.timezone),user.timezone)
        };
      }
      if(strategy)common.strategy={$regex:escapeRegex(strategy),$options:'i'};
      if(instrument)common.instrument={$regex:escapeRegex(instrument),$options:'i'};
      if(outcome!=='all')common.outcome=outcome;
      if(search){
        const match={$regex:escapeRegex(search),$options:'i'};
        common.$or=['instrument','strategy','notes','account','title'].map(field=>({[field]:match}));
      }
      const exampleQuery={...common};
      const tradeQuery={...common,isAPlus:true};
      const [exampleCount,tradeCount]=await Promise.all([
        type==='trade'?0:SetupExample.countDocuments(exampleQuery),
        type==='example'?0:Trade.countDocuments(tradeQuery)
      ]);
      const total=exampleCount+tradeCount;
      const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
      const page=Math.min(Number(pageText),pages);
      const end=page*PAGE_SIZE;
      const [examples,trades]=await Promise.all([
        exampleCount?SetupExample.find(exampleQuery).sort({createdAt:-1,_id:-1}).limit(end).lean():[],
        tradeCount?Trade.find(tradeQuery).sort({createdAt:-1,_id:-1}).limit(end).lean():[]
      ]);
      const items=[
        ...examples.map(record=>({record,isJournal:false})),
        ...trades.map(record=>({record,isJournal:true}))
      ].sort((a,b)=>new Date(b.record.createdAt)-new Date(a.record.createdAt)||
        String(b.record._id).localeCompare(String(a.record._id))||
        Number(a.isJournal)-Number(b.isJournal)).slice((page-1)*PAGE_SIZE,end);
      const filters={search,strategy,instrument,type,outcome,from,to};
      const pageUrl=target=>{
        const query=new URLSearchParams();
        for(const [key,value] of Object.entries(filters))if(value&&value!=='all')query.set(key,value);
        query.set('page',String(target));
        return `/setup-library?${query}`;
      };
      res.render('setup-library',{user,items,total,page,pages,pageUrl,filters,dayKey,timeKey});
    }catch(error){next(error)}
  });
  return router;
};
