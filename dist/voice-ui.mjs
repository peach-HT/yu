import {parseVoiceCommand,createVoiceUpdate} from './voice.mjs?v=13';
import {joinSpeechDraft,readSpeechResults} from './speech-session.mjs?v=13';
const $=id=>document.getElementById(id);
const SpeechAPI=window.SpeechRecognition||window.webkitSpeechRecognition;
const errors={'not-allowed':'未获得麦克风权限，请允许后重试，或直接填写下方内容。','service-not-allowed':'当前浏览器未开放识别服务，请换用浏览器或直接填写。','audio-capture':'没有可用麦克风，请检查设备。','network':'识别服务连接失败，请重试或直接填写。','no-speech':'没有听到声音，可以继续补充或直接填写。','language-not-supported':'识别服务不支持普通话，请换用其他浏览器。','aborted':'本次识别已取消。'};
export function setupVoice({getCard,today,onRecognized,onPending,onError}){
 let cardId=null,recognition=null,token=0,timer=null,draft='',draftSource='voice';
 function abort(){token++;clearTimeout(timer);if(recognition){recognition.onend=null;try{recognition.abort();}catch{}recognition=null;}$('voice-stop').hidden=true;$('voice-start').disabled=!SpeechAPI;$('voice-restart').disabled=!SpeechAPI;}
 function controls(){$('voice-start').textContent=draft?'继续补充':'点击说话';$('voice-restart').hidden=!draft;}
 function discardDraft(){abort();draft='';draftSource='voice';$('voice-heard').hidden=true;$('voice-summary').hidden=true;controls();}
 function fill(text,source){
  abort();draft=text;draftSource=source;controls();$('voice-error').textContent='';$('voice-summary').hidden=true;$('voice-heard').hidden=false;
  $('voice-heard').textContent=`${source==='text-demo'?'演示文字':'听到的话'}：${text}`;
  try{
   const card=getCard(cardId),command=parseVoiceCommand(card,text,today());createVoiceUpdate(card,command,today());onRecognized(command,source);
   $('voice-status').textContent='已填写。可继续补充描述，也可直接修改下方内容，确认后才保存。';$('voice-demo').open=false;
  }catch(err){onError();$('voice-error').textContent=err.message;$('voice-status').textContent='已有字段保留；可继续补充、重新说，或直接修改下方内容。';}
 }
 function reset(id){
  discardDraft();cardId=id;const c=getCard(id);$('voice-error').textContent='';$('voice-demo').open=false;$('voice-demo-input').value='';
  const examples=['今天骑车通勤，沿河风景很好','昨天健身打卡，练了腿','今天吃饭，和朋友一起'];
  $('voice-examples').textContent='可以说：'+examples.map(s=>`“${s}”`).join('、');$('voice-demo-examples').replaceChildren();
  for(const text of examples){const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent=text;b.addEventListener('click',()=>{$('voice-demo-input').value=text;fill(text,'text-demo');});$('voice-demo-examples').append(b);}
  $('voice-status').textContent=SpeechAPI?'可以连续说，结束时点“说完了”；自动结束后可点“继续补充”。':'当前浏览器没有语音识别接口，可以直接填写下方内容。';
 }
 function start(fresh=false){
  abort();if(!SpeechAPI)return;if(fresh){draft='';draftSource='voice';controls();}
  const base=draft,source=draftSource;let failed=false,finalText='',interimText='';const current=++token;
  onPending();$('voice-error').textContent='';$('voice-summary').hidden=true;
  try{
   recognition=new SpeechAPI();recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
   recognition.onstart=()=>{if(current!==token)return;$('voice-status').textContent='正在听，可以连续描述本次使用；说完后点击“说完了”。';$('voice-start').disabled=true;$('voice-restart').disabled=true;$('voice-stop').hidden=false;timer=setTimeout(()=>{try{recognition?.stop();}catch{}},60000);};
   recognition.onresult=e=>{
    if(current!==token)return;({finalText,interimText}=readSpeechResults(e.results));$('voice-heard').hidden=false;
    $('voice-heard').textContent='正在识别：'+joinSpeechDraft(base,joinSpeechDraft(finalText,interimText));
   };
   recognition.onerror=e=>{if(current!==token)return;failed=true;onError();$('voice-error').textContent=errors[e.error]||'识别未成功，请重试或直接填写。';$('voice-status').textContent='已有字段未改变，没有保存记录。';clearTimeout(timer);};
   recognition.onend=()=>{
    if(current!==token)return;clearTimeout(timer);recognition=null;$('voice-stop').hidden=true;$('voice-start').disabled=false;$('voice-restart').disabled=false;
    if(failed||interimText.trim()){
     // Preserve confirmed fragments, but never silently save an unfinished tail.
     draft=joinSpeechDraft(base,finalText);controls();onError();
     if(!failed)$('voice-error').textContent='末尾内容尚未识别完成，请继续补充或直接修改字段。';return;
    }
    if(!finalText.trim()){controls();onError();$('voice-status').textContent='没有收到新的完整内容，请继续说或直接填写。';return;}
    fill(joinSpeechDraft(base,finalText),source);
   };
   $('voice-status').textContent='正在请求麦克风…';$('voice-start').disabled=true;$('voice-restart').disabled=true;recognition.start();
  }catch{abort();onError();$('voice-error').textContent='语音服务未能启动，请检查权限或直接填写。';}
 }
 $('voice-start').addEventListener('click',()=>start());$('voice-restart').addEventListener('click',()=>start(true));
 $('voice-stop').addEventListener('click',()=>{try{recognition?.stop();$('voice-status').textContent='正在整理完整内容…';}catch{}});
 $('voice-demo-parse').addEventListener('click',()=>fill($('voice-demo-input').value,'text-demo'));
 $('voice-demo-input').addEventListener('input',()=>{abort();onPending();$('voice-summary').hidden=true;$('voice-error').textContent='';$('voice-status').textContent='演示文字已改变，请重新回填。';});
 return {reset,abort,discardDraft};
}
