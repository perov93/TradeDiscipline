function isChecklistComplete(state,activeRuleIds){
  if(!state?.checkTime||!activeRuleIds.length)return false;
  const checks=Array.isArray(state.checks)?state.checks:[];
  return checks.length===activeRuleIds.length&&activeRuleIds.every(id=>checks.includes(id));
}

function planFollowUpError(followedPlan,reason){
  if(reason.length>500)return 'The plan deviation reason must be 500 characters or fewer.';
  if(followedPlan===false&&!reason)return 'Explain why you did not follow your plan.';
  return null;
}

module.exports={isChecklistComplete,planFollowUpError};
