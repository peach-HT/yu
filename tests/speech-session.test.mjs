import test from 'node:test';
import assert from 'node:assert/strict';
import {joinSpeechDraft,readSpeechResults} from '../dist/speech-session.mjs';
const result=(text,final=true)=>Object.assign([{transcript:text}],{isFinal:final});
test('累计识别事件不重复累计金额，后续描述与临时结果分开',()=>{
 const first=result('吃饭花了20');
 assert.equal(readSpeechResults([first]).finalText,'吃饭花了20');
 assert.deepEqual(readSpeechResults([first,result('饮料4'),result('和朋友一起',false)]),{finalText:'吃饭花了20，饮料4',interimText:'和朋友一起'});
 assert.deepEqual(readSpeechResults([first,result('饮料4'),result('和朋友一起')]),{finalText:'吃饭花了20，饮料4，和朋友一起',interimText:''});
});
test('跨会话补充不覆盖前文，同金额不同消费不去重',()=>{
 assert.equal(joinSpeechDraft('消费20元','饮料4'),'消费20元，饮料4');
 assert.equal(joinSpeechDraft('消费20元','又消费20元'),'消费20元，又消费20元');
 assert.equal(joinSpeechDraft('吃饭花了','20'),'吃饭花了20');
});
