// Results are cumulative within a session; rebuild rather than append each event.
export function joinSpeechDraft(previous,next){
 const a=previous.trim(),b=next.trim();if(!a)return b;if(!b)return a;
 const bridge=/(?:花了|花费|消费|扣了|支付了|支出了|还剩|剩余|余额|元|块)$/.test(a)&&/^[0-9零〇一二两三四五六七八九十百千万]/.test(b)?'':'，';
 return a+bridge+b;
}
export function readSpeechResults(results){
 let finalText='',interimText='';
 for(let i=0;i<results.length;i++){
  const result=results[i],text=result[0]?.transcript||'';
  if(result.isFinal)finalText=joinSpeechDraft(finalText,text);else interimText=joinSpeechDraft(interimText,text);
 }
 return {finalText,interimText};
}
