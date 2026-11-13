const test=require('node:test');
const assert=require('node:assert/strict');
const {User,Trade}=require('../models');

test('trade entry time accepts valid 24-hour times and leaves legacy records valid',()=>{
  const userId=new User()._id;
  for(const tradeTime of ['00:00','09:05','23:59']){
    const trade=new Trade({user:userId,outcome:'WIN',tradeTime});
    assert.equal(trade.validateSync(),undefined);
  }
  const legacyTrade=new Trade({user:userId,outcome:'WIN'});
  assert.equal(legacyTrade.tradeTime,null);
  assert.equal(legacyTrade.validateSync(),undefined);
});

test('trade entry time rejects malformed and out-of-range values',()=>{
  const userId=new User()._id;
  for(const tradeTime of ['9:05','24:00','12:60']){
    const trade=new Trade({user:userId,outcome:'WIN',tradeTime});
    assert.equal(trade.validateSync().errors.tradeTime.kind,'regexp');
  }
});

test('account count defaults to one and accepts whole values up to 100',()=>{
  const userId=new User()._id;
  const legacyTrade=new Trade({user:userId,outcome:'WIN'});
  assert.equal(legacyTrade.accountCount,1);
  assert.equal(legacyTrade.validateSync(),undefined);
  const multiAccountTrade=new Trade({user:userId,outcome:'WIN',accountCount:5});
  assert.equal(multiAccountTrade.validateSync(),undefined);
});

test('account count rejects values outside the supported whole-number range',()=>{
  const userId=new User()._id;
  for(const accountCount of [0,-1,1.5,101]){
    const trade=new Trade({user:userId,outcome:'WIN',accountCount});
    assert.ok(trade.validateSync().errors.accountCount);
  }
});
