import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const KEY='prepaid-manager-records-v2';
const nativeTimer=globalThis.setTimeout;
globalThis.setTimeout=(fn,ms)=>{const timer=nativeTimer(fn,ms);timer.unref();return timer;};
class Element {
 constructor(){this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.open=false;this.textContent='';this.children=[];this.dataset={};this.handlers={};this.attributes={};this.classList={add(){},remove(){},toggle(){}};}
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
 emit(type){for(const fn of this.handlers[type]??[])fn({target:this,currentTarget:this,preventDefault(){}});}
 click(){if(!this.disabled)this.emit('click');}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 setAttribute(key,value){this.attributes[key]=value;}
 closest(){return null;}
 showModal(){this.open=true;}
 close(){this.open=false;this.emit('close');}
 scrollIntoView(){}
}
function text(element){return [element.textContent,...element.children.map(text)].join(' ');}
function buttons(element){return element.children.flatMap(child=>[child,...buttons(child)]).filter(child=>child.handlers.click);}
let sequence=0;
async function fixture(initial=null){
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const el=id=>elements.get(id)??null;
 for(const id of ['card-form','checkin-form']){
  const section=html.slice(html.indexOf(`<form id="${id}">`));const body=section.slice(0,section.indexOf('</form>'));const fields={};
  for(const match of body.matchAll(/\bname="([^"]+)"/g))fields[match[1]]=new Element();
  fields.namedItem=name=>fields[name];el(id).elements=fields;el(id).reset=()=>{for(const value of Object.values(fields))if(value instanceof Element){value.value='';value.checked=false;}if(fields.type)fields.type.value='term';};el(id).reset();
 }
 const filters=['all','term','count','cash'].map(filter=>Object.assign(new Element(),{dataset:{filter}}));const spotlight=new Element();
 const data=new Map(initial?[[KEY,JSON.stringify(initial)]]:[]);let writes=0;
 globalThis.window={};globalThis.document={getElementById:el,createElement:()=>new Element(),createElementNS:()=>new Element(),querySelector:()=>spotlight,querySelectorAll:selector=>selector==='[data-filter]'?filters:[]};
 globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes++;data.set(key,value);}};globalThis.confirm=()=>true;
 await import(`../dist/app.js?case=${++sequence}`);
 return {el,data,get writes(){return writes;},state:()=>JSON.parse(data.get(KEY))};
}
test('录入储值类权益、编辑、打卡与撤销均无金额字段且没有丢失流程',async()=>{
 const f=await fixture();const editor=f.el('card-form');assert.equal(editor.elements.quantity,undefined);assert.equal(f.el('checkin-form').elements.amount,undefined);
 f.el('add').click();editor.elements.name.value='餐馆权益';editor.elements.type.value='cash';editor.elements.noExpiry.checked=true;editor.emit('submit');assert.equal(f.state().cards.length,1);assert.equal('quantity' in f.state().cards[0],false);
 const card=()=>f.el('cards').children[0];assert.doesNotMatch(text(card()),/¥|记录余额/);
 buttons(card()).find(b=>b.textContent==='编辑').click();editor.elements.name.value='我的餐馆权益';editor.emit('submit');assert.equal(f.state().cards[0].name,'我的餐馆权益');
 buttons(card()).find(b=>b.textContent==='打卡').click();const form=f.el('checkin-form');form.elements.note.value='和朋友聚餐';form.emit('input');form.emit('submit');assert.equal(f.state().events.length,1);assert.equal('debit' in f.state().events[0],false);
 buttons(card()).find(b=>b.textContent==='撤销上次').click();assert.equal(f.state().events[0].undone,true);assert.equal('quantity' in f.state().cards[0],false);
});
test('旧消费与校正记录只读可回顾，编辑与新打卡不修改余额',async()=>{
 const today=new Date().toLocaleDateString('en-CA');const old={id:'old',name:'旧餐馆权益',provider:'',type:'cash',start:'',end:'',noExpiry:true,notes:'',archived:false,revision:2,quantity:28000,verified:''};
 const usage={id:'u',cardId:'old',date:today,note:'历史消费',debit:2000,previousQuantity:30000,afterQuantity:28000,revisionAfter:1,undone:false};
 const adjust={...usage,id:'a',kind:'adjust',note:'历史校正',debit:0,previousQuantity:28000,afterQuantity:28000,previousVerified:'',revisionAfter:2};const initial={cards:[old],events:[adjust,usage],demo:false};
 const f=await fixture(initial);assert.equal(f.writes,0);const card=()=>f.el('cards').children[0];assert.doesNotMatch(text(card()),/¥|记录余额/);assert.equal(buttons(card()).some(b=>b.textContent==='撤销上次'),false);
 buttons(card()).find(b=>b.textContent==='查看使用日历').click();assert.match(text(f.el('history-list')),/旧版记录/);assert.equal(buttons(f.el('history-list')).length,0);
 buttons(card()).find(b=>b.textContent==='编辑').click();f.el('card-form').elements.name.value='已编辑';f.el('card-form').emit('submit');assert.equal(f.state().cards[0].quantity,28000);
 buttons(card()).find(b=>b.textContent==='打卡').click();f.el('checkin-form').emit('submit');assert.equal(f.state().cards[0].quantity,28000);assert.deepEqual(f.state().events.slice(1),initial.events);
});
test('旧表单检测到其他写入时拒绝覆盖，读取损坏状态不写回',async()=>{
 const f=await fixture();f.el('add').click();f.el('card-form').elements.name.value='不能覆盖';f.data.set(KEY,JSON.stringify({cards:[],events:[],demo:true}));f.el('card-form').emit('submit');assert.equal(f.writes,0);assert.match(f.el('form-error').textContent,/发生变化/);
 const broken=await fixture({cards:'broken',events:[],demo:false});assert.equal(broken.el('storage-warning').hidden,false);broken.el('load-demo').click();assert.equal(broken.writes,0);
});
test('示例数据仍可体验期限与储值分类，但没有余额或消费操作',async()=>{
 const f=await fixture();f.el('load-demo').click();assert.equal(f.state().demo,true);assert.equal(f.state().cards.length,3);assert.ok(f.state().cards.every(c=>!('quantity' in c)));assert.doesNotMatch(text(f.el('cards')),/¥|记录余额/);
});
