import test from 'node:test';
import assert from 'node:assert/strict';
import {expiryInfo,sortByExpiry,overviewFor,expiryStage} from '../dist/expiry.mjs';
test('截止日期按今天计算，到期当天与已过期分别展示',()=>{
 assert.equal(expiryInfo({end:'2026-11-12'},'2026-11-09').label,'还有 3 天到期');
 assert.equal(expiryInfo({end:'2026-11-12'},'2026-11-12').label,'今天到期');
 assert.equal(expiryInfo({end:'2026-11-12'},'2026-11-14').label,'已过期 2 天');
 assert.equal(expiryInfo({end:'2026-11-12'},'2026-11-14').expired,true);
});
test('期限状态明确覆盖今天、3天、7天边界，未知不冒充长期有效',()=>{
 for(const [end,key] of [['2026-11-16','expired'],['2026-11-17','today'],['2026-11-18','urgent'],['2026-11-20','urgent'],['2026-11-21','soon'],['2026-11-24','soon'],['2026-11-25','normal']])assert.equal(expiryStage({end},'2026-11-17').key,key);
 assert.equal(expiryStage({end:''},'2026-11-17').key,'unknown');
 assert.equal(expiryStage({end:'',noExpiry:true},'2026-11-17').key,'long');
});
test('生活感概览取真实最近到期项，排除已过期和归档',()=>{
 const cards=[{id:'old',end:'2026-11-08'},{id:'archived',end:'2026-11-09',archived:true},{id:'later',end:'2026-12-01'},{id:'soon',end:'2026-11-12'},{id:'unknown',end:''}];
 const result=overviewFor(cards,'2026-11-09');assert.equal(result.featured.id,'soon');assert.equal(result.currentCount,3);assert.equal(result.expiringCount,1);
 assert.deepEqual(overviewFor([], '2026-11-09'),{currentCount:0,expiringCount:0,featured:null});
 assert.equal(overviewFor([{id:'long',end:'',noExpiry:true}], '2026-11-09').featured.id,'long');
});
test('空日期不视为长期有效，按最近到期排序且不改原数据',()=>{
 assert.equal(expiryInfo({end:''},'2026-11-09').date,'待补充');
 assert.equal(expiryInfo({end:'',noExpiry:true},'2026-11-09').date,'长期有效');
 const cards=[{id:'later',end:'2027-01-01',quantity:8},{id:'expired',end:'2026-11-01'},{id:'soon',end:'2026-11-10'},{id:'unknown',end:''}];
 assert.deepEqual(sortByExpiry(cards,'2026-11-09').map(c=>c.id),['soon','later','expired','unknown']);
 assert.equal(cards[0].id,'later');assert.equal(cards[0].quantity,8);
});
