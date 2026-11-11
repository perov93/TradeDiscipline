const test=require('node:test');
const assert=require('node:assert/strict');
const {SESSION_CHOICES,tradingSessionAt,resolveTradingSession}=require('../lib/market-sessions');

test('records every active weekday session, including overlaps',()=>{
  assert.equal(tradingSessionAt(new Date('2026-11-11T14:00:00Z')),'London / New York');
  assert.equal(tradingSessionAt(new Date('2026-11-11T09:00:00Z')),'London');
});

test('session hours follow daylight-saving time and exclude weekends',()=>{
  assert.equal(tradingSessionAt(new Date('2026-07-01T07:00:00Z')),'Tokyo / London');
  assert.equal(tradingSessionAt(new Date('2026-11-11T07:00:00Z')),'Tokyo');
  assert.equal(tradingSessionAt(new Date('2026-11-14T10:00:00Z')),'Off-session');
});

test('manual session choices override detection and invalid choices are rejected',()=>{
  assert.equal(resolveTradingSession('London',new Date('2026-11-14T10:00:00Z')),'London');
  assert.equal(resolveTradingSession('auto',new Date('2026-11-14T10:00:00Z')),'Off-session');
  assert.equal(resolveTradingSession('Unknown',new Date()),null);
  assert.ok(SESSION_CHOICES.includes('London / New York'));
});
