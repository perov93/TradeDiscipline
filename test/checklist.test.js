const test=require('node:test');
const assert=require('node:assert/strict');
const {User,Trade}=require('../models');
const {isChecklistComplete,planFollowUpError}=require('../lib/checklist');

test('checklist completion requires a timestamp and every active rule exactly once',()=>{
  const completedAt=new Date('2026-11-11T09:00:00Z');
  assert.equal(isChecklistComplete({checkTime:completedAt,checks:['a','b']},['a','b']),true);
  assert.equal(isChecklistComplete({checkTime:completedAt,checks:['a']},['a','b']),false);
  assert.equal(isChecklistComplete({checkTime:null,checks:['a','b']},['a','b']),false);
  assert.equal(isChecklistComplete({checkTime:completedAt,checks:[]},[]),false);
  assert.equal(isChecklistComplete({checkTime:completedAt,checks:['a','a']},['a','b']),false);
});

test('legacy trades keep unknown checklist history and new records default safely',()=>{
  const trade=new Trade({user:new User()._id,outcome:'WIN'});
  assert.equal(trade.checklistCompleted,null);
  assert.equal(trade.planDeviationReason,'');
  assert.equal(Trade.schema.path('planDeviationReason').options.maxlength,500);
});

test('plan deviation explanations are required only when the plan was not followed',()=>{
  assert.equal(planFollowUpError(true,''),null);
  assert.equal(planFollowUpError(false,'I entered before confirmation.'),null);
  assert.equal(planFollowUpError(false,''),'Explain why you did not follow your plan.');
  assert.equal(planFollowUpError(true,'x'.repeat(501)),'The plan deviation reason must be 500 characters or fewer.');
});
