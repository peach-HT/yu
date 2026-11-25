import test from 'node:test';
import assert from 'node:assert/strict';
class Element{
 constructor(){this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.handlers={};this.children=[];}
 addEventListener(name,fn){this.handlers[name]=fn;}
 replaceChildren(){this.children=[];}
 append(child){this.children.push(child);}
 click(){this.handlers.click?.();}
}
class MockSpeech{
 static latest;
 constructor(){MockSpeech.latest=this;}
 start(){this.onstart?.();}
 stop(){this.onend?.();}
 abort(){}
}
globalThis.window={SpeechRecognition:MockSpeech};
const {setupVoice}=await import('../dist/voice-ui.mjs');
const card={id:'cash',name:'测试',provider:'',type:'cash',start:'',end:'',noExpiry:true,verified:'',notes:'',archived:false,revision:0};
const result=(text,final=true)=>Object.assign([{transcript:text}],{isFinal:final});
function fixture(){
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 globalThis.document={getElementById:el,createElement:()=>new Element()};
 const commands=[],state={pending:0,errors:0};
 const controller=setupVoice({getCard:()=>card,today:()=> '2026-10-25',onRecognized:(cmd,source)=>commands.push({cmd,source}),onPending:()=>state.pending++,onError:()=>state.errors++});
 controller.reset(card.id);return {el,commands,state,controller};
}

test('累计结果只回填一次，跨会话追加完整使用描述',()=>{
 const {el,commands,controller}=fixture();el('voice-start').click();let speech=MockSpeech.latest;
 assert.equal(speech.continuous,true);speech.onresult({results:[result('今天骑车')]});speech.onresult({results:[result('今天骑车'),result('去了图书馆',false)]});assert.equal(commands.length,0);
 speech.onresult({results:[result('今天骑车'),result('去了图书馆')]});speech.onend();assert.equal(commands.length,1);assert.equal(commands[0].cmd.transcript,'今天骑车，去了图书馆');assert.equal(el('voice-start').textContent,'继续补充');
 el('voice-start').click();speech=MockSpeech.latest;speech.onresult({results:[result('沿河风景很好')]});speech.onend();assert.equal(commands[1].cmd.transcript,'今天骑车，去了图书馆，沿河风景很好');controller.abort();
});
test('未完成尾句不回填，可继续补充已确认片段',()=>{
 const {el,commands,state,controller}=fixture();el('voice-start').click();let speech=MockSpeech.latest;speech.onresult({results:[result('今天骑车'),result('去了',false)]});speech.onend();assert.equal(commands.length,0);assert.equal(state.errors,1);
 el('voice-start').click();speech=MockSpeech.latest;speech.onresult({results:[result('去了图书馆')]});speech.onend();assert.equal(commands[0].cmd.transcript,'今天骑车，去了图书馆');controller.abort();
});
test('手动编辑后迟到识别不能覆盖，重新说替换草稿',()=>{
 const {el,commands,controller}=fixture();el('voice-start').click();const old=MockSpeech.latest;controller.discardDraft();old.onresult({results:[result('今天骑车')]});old.onend?.();assert.equal(commands.length,0);
 el('voice-start').click();let speech=MockSpeech.latest;speech.onresult({results:[result('今天健身')]});speech.onend();el('voice-restart').click();speech=MockSpeech.latest;speech.onresult({results:[result('昨天打球')]});speech.onend();assert.equal(commands.at(-1).cmd.transcript,'昨天打球');assert.equal(commands.at(-1).cmd.date,'2026-10-24');controller.abort();
});
test('包含多个金额的语音只保留描述，不显示金额汇总',()=>{
 const {el,commands,controller}=fixture();el('voice-start').click();const speech=MockSpeech.latest;speech.onresult({results:[result('消费35.5，其中吃饭30，饮料5.5')]});speech.onend();assert.equal(commands[0].cmd.intent,'checkin');assert.equal('amount' in commands[0].cmd,false);assert.equal(el('voice-summary').hidden,true);controller.abort();
});
test('识别服务失败及校正请求保留字段并阻止误提交',()=>{
 const {el,commands,state,controller}=fixture();el('voice-start').click();let speech=MockSpeech.latest;speech.onerror({error:'network'});speech.onend();assert.equal(commands.length,0);assert.ok(state.errors>=1);const failures=state.errors;
 el('voice-start').click();speech=MockSpeech.latest;speech.onresult({results:[result('余额还剩两百')]});speech.onend();assert.equal(commands.length,0);assert.ok(state.errors>failures);controller.abort();
});
