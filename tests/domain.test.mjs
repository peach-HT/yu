import test from 'node:test';
import assert from 'node:assert/strict';
import {validDate,validateCard,validateState,createCheckin,undoCheckin,isLegacyAccounting,monthCells,shiftMonth} from '../dist/domain.mjs';
const today='2026-11-25';
const card=(type='cash')=>({id:'c',type,name:'测试权益',provider:'',start:'',end:'2026-12-01',noExpiry:false,notes:'',archived:false,revision:0});
const input={date:today,note:'今天使用了权益'};
test('所有类型均可仅记录名称和期限，不要求余额或次数',()=>{for(const type of ['term','count','cash'])assert.equal(validateCard(card(type)),true);});
test('日期校验拒绝不存在的日期及颠倒期限',()=>{assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2024-02-29'),true);assert.equal(validateCard({...card(),start:'2027-01-01'}),false);assert.equal(validateCard({...card(),noExpiry:true}),false);});
test('旧余额和次数兼容读取，但新打卡不扣减且不污染原对象',()=>{
 for(const type of ['cash','count']){const old={...card(type),quantity:type==='cash'?28000:8,verified:'2026-11-20'};const snapshot=structuredClone(old);const result=createCheckin(old,input,today);assert.deepEqual(old,snapshot);assert.equal(result.card.quantity,old.quantity);assert.equal(result.card.verified,old.verified);assert.equal(result.event.kind,'use');for(const key of ['debit','amount','previousQuantity','afterQuantity'])assert.equal(key in result.event,false);}
});
test('新打卡不生成任何余量字段',()=>{const result=createCheckin(card(),input,today);assert.equal('quantity' in result.card,false);assert.equal(result.card.revision,1);assert.equal(result.event.note,input.note);});
test('旧扣减调用不会悄悄变为成功的记账',()=>{for(const extra of [{debit:true},{amount:'20'},{units:1}])assert.throws(()=>createCheckin(card(),{...input,...extra},today),/不维护/);});
test('拒绝归档、未来日期、期限外及过长备注',()=>{
 assert.throws(()=>createCheckin({...card(),archived:true},input,today),/恢复/);
 for(const date of ['2026-11-26','2026-02-30',''])assert.throws(()=>createCheckin(card(),{...input,date},today));
 assert.throws(()=>createCheckin({...card(),start:'2026-11-25'},{...input,date:'2026-11-24'},today),/有效期/);
 assert.throws(()=>createCheckin({...card(),end:'2026-11-24'},input,today),/有效期/);
 assert.throws(()=>createCheckin(card(),{...input,note:'字'.repeat(161)},today),/160/);
});
test('新打卡可以撤销，但只改记录版本，不恢复旧金额',()=>{const old={...card(),quantity:28000},result=createCheckin(old,input,today);const reverted=undoCheckin(result.card,result.event);assert.equal(reverted.quantity,28000);assert.equal(reverted.revision,2);assert.throws(()=>undoCheckin({...result.card,revision:2},result.event),/后续/);assert.throws(()=>undoCheckin(result.card,{...result.event,undone:true}));});
test('旧消费和校正记录不可通过撤销修改余额',()=>{for(const e of [{kind:'adjust',debit:0},{kind:'use',debit:2000}]){assert.equal(isLegacyAccounting(e),true);assert.throws(()=>undoCheckin(card(),e),/旧版/);}});
const event=()=>({id:'e',cardId:'c',...createCheckin(card(),input,today).event});
test('新状态与旧状态可以混合读取，历史数据不变',()=>{
 const old={...card(),quantity:28000,verified:''};const usage={id:'old',cardId:'c',date:today,note:'旧消费',debit:2000,previousQuantity:30000,afterQuantity:28000,revisionAfter:1,undone:false};
 const correction={...usage,id:'adjust',kind:'adjust',debit:-1000,previousQuantity:27000,afterQuantity:28000,previousVerified:''};
 const state={cards:[old],events:[usage,correction,event()],demo:false},snapshot=structuredClone(state);assert.equal(validateState(state),true);assert.deepEqual(state,snapshot);
});
test('损坏状态、悬空记录、重复id不能通过校验',()=>{const good={cards:[card()],events:[event()],demo:false};assert.equal(validateState(good),true);for(const bad of [{...good,cards:[card(),card()]},{...good,events:[event(),event()]},{...good,events:[{...event(),cardId:'missing'}]},{...good,events:[{...event(),debit:1}]},{...good,cards:[{...card(),quantity:-1}]}])assert.equal(validateState(bad),false);});
test('日历跨年及闰月使用周一起始',()=>{assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');const cells=monthCells('2024-02');assert.equal(cells.filter(Boolean).length,29);assert.equal(cells[3],'2024-02-01');});
