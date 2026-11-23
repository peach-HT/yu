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
const card={id:'cash',name:'测试',provider:'',type:'cash',quantity:28000,start:'',end:'',noExpiry:true,verified:'',notes:'',archived:false,revision:0};
const result=(text,final=true)=>Object.assign([{transcript:text}],{isFinal:final});
function fixture(){
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 globalThis.document={getElementById:el,createElement:()=>new Element()};
 const commands=[],state={pending:0,errors:0};
 const controller=setupVoice({getCard:()=>card,today:()=> '2026-10-25',onRecognized:(cmd,source)=>commands.push({cmd,source}),onPending:()=>state.pending++,onError:()=>state.errors++});
 controller.reset(card.id);return {el,commands,state,controller};
}
test('模拟浏览器多段结果与跨会话补充，完整原话只回填一次',()=>{
 const {el,commands,controller}=fixture();el('voice-start').click();let speech=MockSpeech.latest;
 assert.equal(speech.continuous,true);
 speech.onresult({results:[result('吃饭花了20')]});
 speech.onresult({results:[result('吃饭花了20'),result('饮料4',false)]});
 assert.equal(commands.length,0);
 speech.onresult({results:[result('吃饭花了20'),result('饮料4')]});speech.onend();
 assert.equal(commands.length,1);assert.equal(commands[0].cmd.amount,2400);assert.equal(el('voice-start').textContent,'继续补充');assert.match(el('voice-summary').textContent,/20.00 \+ 4.00 = 24.00/);
 el('voice-start').click();speech=MockSpeech.latest;speech.onresult({results:[result('和朋友一起吃饭')]});speech.onend();
 assert.equal(commands.length,2);assert.equal(commands[1].cmd.amount,2400);assert.match(commands[1].cmd.transcript,/吃饭花了20，饮料4，和朋友一起吃饭/);controller.abort();
});
test('未完成尾句不回填，后续可补充已确认片段',()=>{
 const {el,commands,state,controller}=fixture();el('voice-start').click();let speech=MockSpeech.latest;
 speech.onresult({results:[result('吃饭花了20'),result('饮料',false)]});speech.onend();
 assert.equal(commands.length,0);assert.equal(state.errors,1);
 el('voice-start').click();speech=MockSpeech.latest;speech.onresult({results:[result('饮料4')]});speech.onend();
 assert.equal(commands[0].cmd.amount,2400);controller.abort();
});
test('手动编辑或关闭后迟到识别不覆盖字段，重新说替换旧草稿',()=>{
 const {el,commands,controller}=fixture();el('voice-start').click();const old=MockSpeech.latest;
 controller.discardDraft();old.onresult({results:[result('消费20元')]});old.onend?.();assert.equal(commands.length,0);
 el('voice-start').click();let speech=MockSpeech.latest;speech.onresult({results:[result('消费20元')]});speech.onend();
 el('voice-restart').click();speech=MockSpeech.latest;speech.onresult({results:[result('消费30元')]});speech.onend();
 assert.equal(commands.at(-1).cmd.amount,3000);assert.equal(commands.at(-1).cmd.transcript,'消费30元');controller.abort();
});
test('总额后继续补充其中明细，校验后金额不被叠加',()=>{
 const {el,commands,controller}=fixture();el('voice-start').click();let speech=MockSpeech.latest;
 speech.onresult({results:[result('消费35.5')]});speech.onend();assert.equal(commands[0].cmd.amount,3550);
 el('voice-start').click();speech=MockSpeech.latest;speech.onresult({results:[result('其中吃饭30'),result('饮料5.5')]});speech.onend();
 assert.equal(commands.at(-1).cmd.amount,3550);assert.match(el('voice-summary').textContent,/30.00 \+ 5.50 = 35.50/);assert.match(el('voice-summary').textContent,/只扣一次/);controller.abort();
});
