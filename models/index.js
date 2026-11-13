const mongoose=require('mongoose');
const {Schema,model}=mongoose;
const userSchema=new Schema({email:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true},name:{type:String,required:true,trim:true,maxlength:80},limits:{maxTrades:{type:Number,default:3,min:1,max:100},maxLosses:{type:Number,default:2,min:1,max:100},cooldownMinutes:{type:Number,default:15,min:1,max:240}},timezone:{type:String,default:'Europe/Sofia'}},{timestamps:true});
const limitsSchema=new Schema({
  maxTrades:{type:Number,required:true,min:1,max:100},
  maxLosses:{type:Number,required:true,min:1,max:100},
  cooldownMinutes:{type:Number,required:true,min:1,max:240}
},{_id:false});
const {DEFAULT_PREFERENCES,TABS,ANALYSIS_RANGES}=require('../lib/settings');
const preferencesSchema=new Schema({
  defaultCurrency:{type:String,default:DEFAULT_PREFERENCES.defaultCurrency,match:/^[A-Z]{3}$/},
  calendarCurrency:{type:String,default:DEFAULT_PREFERENCES.calendarCurrency,match:/^[A-Z]{3}$/},
  analysisRange:{type:String,default:DEFAULT_PREFERENCES.analysisRange,enum:ANALYSIS_RANGES},
  defaultTab:{type:String,default:DEFAULT_PREFERENCES.defaultTab,enum:TABS},
  showWorldClocks:{type:Boolean,default:true},
  showForexHours:{type:Boolean,default:true},
  showNyReminder:{type:Boolean,default:true},
  showEconomicCalendar:{type:Boolean,default:true},
  showMotivationalMessage:{type:Boolean,default:true},
  motivationalMessage:{type:String,default:DEFAULT_PREFERENCES.motivationalMessage,trim:true,maxlength:500}
},{_id:false});
userSchema.add({
  preferences:{type:preferencesSchema,default:()=>({})},
  pendingSettings:{type:new Schema({
    timezone:{type:String,required:true},
    limits:{type:limitsSchema,required:true},
    effectiveAt:{type:Date,required:true}
  },{_id:false}),default:null}
});
const ruleSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},title:{type:String,required:true,maxlength:140},description:{type:String,default:'',maxlength:500},active:{type:Boolean,default:true},order:{type:Number,default:0}},{timestamps:true});
const tradeSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},account:{type:String,default:'',maxlength:80},accountCount:{type:Number,default:1,min:1,max:100,validate:{validator:Number.isInteger,message:'Account count must be a whole number.'}},session:{type:String,default:'',maxlength:80},checklistCompleted:{type:Boolean,default:null},planDeviationReason:{type:String,default:'',maxlength:500},instrument:{type:String,default:'',maxlength:40},side:{type:String,enum:['BUY','SELL',''],default:''},strategy:{type:String,default:'',maxlength:120},outcome:{type:String,enum:['WIN','LOSS','BREAKEVEN'],required:true},pnl:{type:Number,default:0},currency:{type:String,default:'USD',uppercase:true,match:/^[A-Z]{3}$/},tradeTime:{type:String,default:null,match:/^(?:[01]\d|2[0-3]):[0-5]\d$/},images:{type:[new Schema({id:{type:String,required:true},mime:{type:String,enum:['image/jpeg','image/png','image/webp'],required:true}},{_id:false})],default:[]},imageId:{type:String,default:''},imageMime:{type:String,enum:['','image/jpeg','image/png','image/webp'],default:''},notes:{type:String,default:'',maxlength:3000},emotion:{type:String,enum:['calm','fomo','revenge','other'],default:'calm'},followedPlan:{type:Boolean,default:true},createdAt:{type:Date,default:Date.now,index:true}},{timestamps:true});
const stateSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',unique:true,required:true},dayKey:{type:String,default:''},stopped:{type:Boolean,default:false},cooldownUntil:{type:Date,default:null},checks:{type:[String],default:[]},checkTime:{type:Date,default:null}},{timestamps:true});
const eventSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},type:{type:String,required:true},detail:{type:String,default:''},at:{type:Date,default:Date.now}},{timestamps:true});
const noSetupSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},date:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},notes:{type:String,default:'',maxlength:3000}},{timestamps:true});
noSetupSchema.index({user:1,date:-1});
module.exports={User:model('User',userSchema),Rule:model('Rule',ruleSchema),Trade:model('Trade',tradeSchema),State:model('State',stateSchema),Event:model('Event',eventSchema),NoSetup:model('NoSetup',noSetupSchema)};
