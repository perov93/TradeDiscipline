const test=require('node:test');
const assert=require('node:assert/strict');
const {recordReturnTo}=require('../lib/navigation');

test('record navigation returns to a safe calendar URL and restores only a valid day',()=>{
  assert.equal(recordReturnTo({returnTo:'calendar',returnDate:'2024-02-29'}),'/?calendarDate=2024-02-29#calendar');
  assert.equal(recordReturnTo({returnTo:'calendar',returnDate:'2026-02-30'}),'/#calendar');
  assert.equal(recordReturnTo({returnTo:'calendar',returnDate:'https://example.com'}),'/#calendar');
  assert.equal(recordReturnTo({returnTo:'https://example.com',returnDate:'2024-02-29'}),'/#journal');
  assert.equal(recordReturnTo({}),'/#journal');
});
