import test from 'node:test';
import assert from 'node:assert/strict';
import {spokenNumber,spokenMoney,parseVoiceCommand,createVoiceUpdate} from '../dist/voice.mjs';
import {quickChoice,undoCheckin} from '../dist/domain.mjs';
const today='2026-10-25';
const count={id:'count',name:'骑行卡',provider:'测试服务',type:'count',quantity:8,start:'',end:'',noExpiry:false,verified:'2026-10-20',notes:'',archived:false,revision:0};
const cash={...count,id:'cash',name:'餐馆',type:'cash',quantity:28000};
const term={...count,id:'term',name:'健身',type:'term',quantity:null};
test('中文数值转换保留明确语义',()=>{assert.equal(spokenNumber('两百零五'),205);assert.equal(spokenNumber('三十五'),35);assert.equal(spokenNumber('一万二千三百四十五'),12345);assert.equal(spokenNumber('三十五点五'),35.5);assert.throws(()=>spokenNumber('一百二'));});
test('元角分及口语尾数',()=>{for(const [text,result] of [['三十五块五',3550],['三十五元五角',3550],['三十五元五角六分',3556],['两百块',20000],['35.50',3550],['五毛',50],['五分',5],['一元零五分',105]])assert.equal(spokenMoney(text),result,text);});
test('语音消费只生成结果不修改原卡',()=>{const cmd=parseVoiceCommand(cash,'刚才消费三十五块五',today);assert.equal(cmd.intent,'consume');assert.equal(cmd.amount,3550);const r=createVoiceUpdate(cash,cmd,today);assert.equal(r.card.quantity,24450);assert.equal(cash.quantity,28000);});
test('余额校正与消费分开且可撤销',()=>{const cmd=parseVoiceCommand(cash,'现在还剩两百块',today);assert.equal(cmd.intent,'adjust');const r=createVoiceUpdate(cash,cmd,today);assert.equal(r.card.quantity,20000);assert.equal(r.event.kind,'adjust');assert.equal(undoCheckin(r.card,r.event).quantity,28000);assert.equal(undoCheckin(r.card,r.event).verified,'2026-10-20');});
test('余额增加校正不伪装负消费',()=>{const r=createVoiceUpdate(cash,parseVoiceCommand(cash,'余额还有五百元',today),today);assert.equal(r.card.quantity,50000);assert.equal(r.event.kind,'adjust');assert.equal(r.event.debit,-22000);});
test('未知余量可由明确校正补全并撤销回未知',()=>{const c={...cash,quantity:null};const r=createVoiceUpdate(c,parseVoiceCommand(c,'现在还剩200元',today),today);assert.equal(r.card.quantity,20000);assert.equal(undoCheckin(r.card,r.event).quantity,null);});
test('次卡语音只记录使用，不维护剩余次数',()=>{for(const text of ['今天骑了一次','今天使用了两次','今天骑车']){const cmd=parseVoiceCommand(count,text,today);assert.equal(cmd.intent,'checkin');const r=createVoiceUpdate(count,cmd,today);assert.equal(r.card.quantity,8);assert.equal(r.event.debit,0);}});
test('新版本拒绝余次校正，旧余次数值保留',()=>{assert.throws(()=>parseVoiceCommand(count,'现在还剩五次',today),/不维护剩余次数/);assert.throws(()=>createVoiceUpdate(count,{intent:'adjust',date:today,quantity:5},today));assert.equal(count.quantity,8);});
test('仅打卡不扣次；会员训练时长不当次数',()=>{assert.equal(createVoiceUpdate(count,parseVoiceCommand(count,'今天只打卡，不扣次',today),today).card.quantity,8);const cmd=parseVoiceCommand(term,'今天练了一个小时',today);assert.equal(cmd.intent,'checkin');assert.equal(createVoiceUpdate(term,cmd,today).card.quantity,null);});
test('裸金额不猜意图、问题和混合语义不自动处理',()=>{for(const text of ['三十五块','消费多少','消费35元，还剩200元','不是消费35元是余额200元','消费35元，骑了一次','大概消费35元','明天消费35元'])assert.throws(()=>parseVoiceCommand(cash,text,today),undefined,text);});
test('金额需明确且不允许负数或超精度',()=>{for(const text of ['消费了','消费负35元','消费-35元','消费1.234元','消费一百二元'])assert.throws(()=>parseVoiceCommand(cash,text,today),undefined,text);});
test('实际使用日期与余额校正日期约束',()=>{const cmd=parseVoiceCommand(count,'昨天骑了一次',today);assert.equal(cmd.date,'2026-10-24');assert.equal(parseVoiceCommand(count,'2026年10月20日骑了一次',today).date,'2026-10-20');assert.throws(()=>parseVoiceCommand(cash,'昨天还剩200元',today));assert.throws(()=>parseVoiceCommand(term,'今天记录昨天健身打卡',today));});
test('不跨卡型推断金额与次数',()=>{assert.throws(()=>parseVoiceCommand(count,'消费35元',today));assert.throws(()=>parseVoiceCommand(term,'还剩五次',today));assert.equal(parseVoiceCommand(count,'今天骑车',today).intent,'checkin');});
test('未知余量和超额消费阻止生成可保存更新',()=>{assert.throws(()=>createVoiceUpdate({...cash,quantity:null},parseVoiceCommand(cash,'消费35元',today),today));assert.throws(()=>createVoiceUpdate(cash,parseVoiceCommand(cash,'消费300元',today),today));});

test('实际反馈：吃饭花了20饮料4合计24元并保留原话',()=>{
 const raw='吃饭花了20，饮料4';const cmd=parseVoiceCommand(cash,raw,today);
 assert.equal(cmd.amount,2400);assert.deepEqual(cmd.amounts,[2000,400]);
 const result=createVoiceUpdate(cash,cmd,today);assert.equal(result.card.quantity,25600);assert.equal(result.event.note,raw);
 assert.equal(parseVoiceCommand(cash,'吃饭花了20饮料4',today).amount,2400);
});
test('多笔消费支持单位省略中文金额与连续语句',()=>{
 for(const [raw,amount] of [['午餐消费30元，饮料消费8元',3800],['消费35元，然后消费10元',4500],['吃饭花了二十，饮料四',2400],['花了20元和4元',2400],['吃饭花了20，咖啡4，豆浆3',2700],['消费三十五块五，另外消费四块五',4000]])assert.equal(parseVoiceCommand(cash,raw,today).amount,amount,raw);
});
test('金额后补充内容不被拒绝，数量时间桌号不当金额',()=>{
 for(const raw of ['吃饭花了20，和朋友一起吃饭','消费20元，买了2杯咖啡，坐在3号桌','消费20元，跑步30分钟，下午3点到家','消费20元，评分5分','消费20，今天很开心']){const cmd=parseVoiceCommand(cash,raw,today);assert.equal(cmd.amount,2000,raw);assert.equal(cmd.transcript,raw);}
});
test('明确合计不重复相加，不一致与优惠明细要求核对',()=>{
 assert.equal(parseVoiceCommand(cash,'吃饭花了20，饮料4，一共24元',today).amount,2400);
 assert.equal(parseVoiceCommand(cash,'吃饭花了20，饮料4，一共24',today).amount,2400);
 assert.equal(parseVoiceCommand(cash,'一共消费24元，午餐20元，饮料4元',today).amount,2400);
 for(const raw of ['花了20元，饮料4元，一共30元','消费原价30元，优惠5元','消费20元，余额还剩100元'])assert.throws(()=>parseVoiceCommand(cash,raw,today),undefined,raw);
});
test('实测原话：总额35.5与其中30加5.5只扣35.5',()=>{
 for(const raw of ['消费35.5，其中吃饭30，饮料5.5','消费35.5其中吃饭30饮料5.5','消费三十五块五，其中吃饭三十元，饮料五块五，和朋友一起']){
  const cmd=parseVoiceCommand(cash,raw,today);assert.equal(cmd.amount,3550);assert.deepEqual(cmd.amounts,[3000,550]);assert.equal(cmd.hasTotal,true);assert.equal(cmd.remainder,0);
  const result=createVoiceUpdate(cash,cmd,today);assert.equal(result.event.debit,3550);assert.equal(result.card.quantity,24450);assert.equal(result.event.note,raw);
 }
});
test('其中可说明部分明细，超过总额时不自动扣款',()=>{
 const cmd=parseVoiceCommand(cash,'消费20元，其中饮料4元',today);assert.equal(cmd.amount,2000);assert.equal(cmd.remainder,1600);assert.deepEqual(cmd.amounts,[400]);
 assert.throws(()=>parseVoiceCommand(cash,'消费35.5，其中吃饭30，饮料6',today),/超过总额/);
 for(const raw of ['消费35.5，其中','消费35.5，其中吃饭30，饮料5.5，合计71元'])assert.throws(()=>parseVoiceCommand(cash,raw,today));
});

test('未知或零余次也能记录使用，旧数据不被重置',()=>{for(const quantity of [null,0,8]){const c={...count,quantity},cmd=parseVoiceCommand(c,'今天骑车通勤',today);const r=createVoiceUpdate(c,cmd,today);assert.equal(r.card.quantity,quantity);assert.equal(r.event.debit,0);assert.equal(r.event.note,'今天骑车通勤');}});
