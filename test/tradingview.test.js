const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {User,Trade}=require('../models');
const {tradingViewSnapshotId}=require('../lib/tradingview');

test('accepts public TradingView snapshot links and extracts only the snapshot ID',()=>{
  assert.equal(tradingViewSnapshotId('https://www.tradingview.com/x/ZWvJ4X1B/'),'ZWvJ4X1B');
  assert.equal(tradingViewSnapshotId(' https://www.tradingview.com/x/ZWvJ4X1B?utm_source=share '),'ZWvJ4X1B');
  assert.equal(tradingViewSnapshotId(''),'');
});

test('rejects non-TradingView URLs and malformed snapshot IDs',()=>{
  for(const value of [
    'http://www.tradingview.com/x/ZWvJ4X1B/',
    'https://tradingview.com/x/ZWvJ4X1B/',
    'https://www.tradingview.com.evil.example/x/ZWvJ4X1B/',
    'https://www.tradingview.com@evil.example/x/ZWvJ4X1B/',
    'https://www.tradingview.com:444/x/ZWvJ4X1B/',
    'https://www.tradingview.com/chart/ZWvJ4X1B/',
    'https://www.tradingview.com/x/invalid/'
  ])assert.equal(tradingViewSnapshotId(value),null,value);
});

test('trade records persist a validated snapshot ID without affecting legacy records',()=>{
  const user=new User();
  const trade=new Trade({user:user._id,outcome:'WIN',tradingViewId:'ZWvJ4X1B'});
  assert.equal(trade.validateSync(),undefined);
  const legacyTrade=new Trade({user:user._id,outcome:'WIN'});
  assert.equal(legacyTrade.tradingViewId,'');
  assert.equal(legacyTrade.validateSync(),undefined);
  const invalidTrade=new Trade({user:user._id,outcome:'WIN',tradingViewId:'https://example.com/image.png'});
  assert.ok(invalidTrade.validateSync().errors.tradingViewId);
});

test('browser snapshot preview only derives images from valid TradingView links',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('function tradingViewSnapshotId'),source.indexOf("document.querySelectorAll('.image-preview-trigger')"));
  const {tradingViewSnapshotId,tradingViewSnapshotImageUrl}=vm.runInNewContext(
    `${block}\n({tradingViewSnapshotId,tradingViewSnapshotImageUrl})`,{URL}
  );
  const id=tradingViewSnapshotId('https://www.tradingview.com/x/ZWvJ4X1B/');
  assert.equal(id,'ZWvJ4X1B');
  assert.equal(tradingViewSnapshotImageUrl(id),'https://s3.tradingview.com/snapshots/z/ZWvJ4X1B.png');
  assert.equal(tradingViewSnapshotId('https://example.com/x/ZWvJ4X1B/'),null);
});
