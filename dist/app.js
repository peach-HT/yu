import {parseQuantity,editedQuantity,validateCard,createCheckin,undoCheckin,validDate,monthCells,shiftMonth} from "./domain.mjs?v=12";
import {setupVoice} from './voice-ui.mjs?v=12';
import {createVoiceUpdate} from './voice.mjs?v=12';
import {expiryInfo,sortByExpiry,overviewFor,expiryStage} from './expiry.mjs?v=12';
const $=id=>document.getElementById(id), KEY="prepaid-manager-records-v2";
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const id=()=>crypto.randomUUID(), labels={term:"期限会员",count:"次数卡",cash:"储值卡"};
let state={cards:[],events:[],demo:false}, filter="all", editing=null, checking=null, historyId=null, locked=false, calendarMonth=today().slice(0,7), selectedDate=today();
const money=n=>(n/100).toLocaleString("zh-CN",{minimumFractionDigits:2,maximumFractionDigits:2});
function validEvent(e,cards){
 const c=cards.find(c=>c.id===e?.cardId);
 if(!c||typeof e.id!=="string"||!e.date||!validDate(e.date)||typeof e.note!=="string"||e.note.length>160||!Number.isSafeInteger(e.debit)||typeof e.undone!=="boolean"||!Number.isInteger(e.revisionAfter)||e.revisionAfter<1||![e.previousQuantity,e.afterQuantity].every(q=>q===null||(Number.isSafeInteger(q)&&q>=0)))return false;
 if(e.kind==='adjust')return c.type!=='term'&&e.afterQuantity!==null&&e.afterQuantity<=(c.type==='count'?9999:9999999999)&&(e.previousQuantity===null?e.debit===0:e.previousQuantity-e.debit===e.afterQuantity)&&typeof e.previousVerified==='string'&&validDate(e.previousVerified);
 if(e.debit<0||(e.kind&&e.kind!=='use'))return false;
 return e.previousQuantity===null?e.debit===0&&e.afterQuantity===null:e.previousQuantity-e.debit===e.afterQuantity;
}
try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);if(!s||!Array.isArray(s.cards)||!Array.isArray(s.events)||typeof s.demo!=="boolean"||!s.cards.every(validateCard)||new Set(s.cards.map(c=>c.id)).size!==s.cards.length||!s.events.every(e=>validEvent(e,s.cards)))throw Error();state=s;}}catch{locked=true;$("storage-warning").hidden=false;}
let featuredId=null;
let timer;
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("visible");clearTimeout(timer);timer=setTimeout(()=>$("toast").classList.remove("visible"),3500);}
function save(next){if(locked){toast("保存已暂停，原数据未被覆盖。");return false;}try{localStorage.setItem(KEY,JSON.stringify(next));state=next;render();return true;}catch{toast("保存失败，本次修改未保存。请检查浏览器存储空间。");return false;}}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(text,cls,action){const b=el("button",cls,text);b.addEventListener("click",action);return b;}
function svgIcon(name){const n=document.createElementNS('http://www.w3.org/2000/svg','svg'),u=document.createElementNS('http://www.w3.org/2000/svg','use');n.setAttribute('aria-hidden','true');u.setAttribute('href','#i-'+name);n.append(u);return n;}
function iconFor(c){const name=c.name+' '+c.provider;return /羽毛球|网球|球场/.test(name)?'racket':/骑行|单车|电单车/.test(name)?'bike':/健身|瑜伽/.test(name)?'gym':/咖啡|餐|茶/.test(name)?'coffee':/阅读|读书/.test(name)?'book':/视频|影音|电影/.test(name)?'play':c.type==='cash'?'coffee':'calendar';}
function eventsFor(cardId){return state.events.filter(e=>e.cardId===cardId);}
function activeEvents(cardId){return eventsFor(cardId).filter(e=>!e.undone&&e.kind!=='adjust');}
function render(){
 const archived=$("show-archived").checked,query=$("search").value.trim().toLocaleLowerCase();
 const visible=sortByExpiry(state.cards.filter(c=>c.archived===archived&&(filter==="all"||c.type===filter)&&`${c.name} ${c.provider}`.toLocaleLowerCase().includes(query)),today());
 const active=state.cards.filter(c=>!c.archived);
 const overview=overviewFor(state.cards,today());featuredId=overview.featured?.id??null;
 $('hero-total').textContent=overview.currentCount;$('hero-soon').textContent=overview.expiringCount;$('collection-count').textContent=visible.length;
 const featured=overview.featured,info=featured?expiryInfo(featured,today()):null;
 document.querySelector(".spotlight").dataset.state=featured?expiryStage(featured,today()).key:"empty";
 $('spotlight-title').textContent=featured?.name||'把美好收进来';$('spotlight-provider').textContent=featured?(featured.provider||'服务方待补充'):'从第一项权益开始';
 $('spotlight-kind').textContent=info?.days!==null&&info?'最近到期':'收好这份拥有';$('spotlight-days').textContent=info?.days!==null&&info?String(info.days).padStart(2,'0'):'—';
 $('spotlight-days').classList.toggle('many-days',!!info&&info.days>99);
 $('spotlight-unit').textContent=!info?'等待第一项权益':info.days===null?(featured.noExpiry?'长期有效':'截止日期待补充'):info.days===0?'今天到期':'天后到期';
 $('spotlight-date').textContent=info?.days!==null&&info?`${info.date} 截止`:featured?.noExpiry?'长期有效':'截止日期待补充';$('spotlight-action').textContent=featured?'查看权益':'添加权益';
 $('spotlight-caption').textContent=info?.days===0?'今天到期，有空记得看一看':'喜欢的事，记得留时间';
 if(featured&&info.days!==null&&info.days<=7)$('spotlight-kind').textContent='最近到期 · '+expiryStage(featured,today()).label;
 $('summary').textContent=archived?'已归档权益 · 可恢复到当前清单':'最近到期的，排在前面 · 不需要维护使用次数';
 $('demo-banner').hidden=!state.demo;$('cards').replaceChildren();$('expired-cards').replaceChildren();const expiredCount=archived?0:visible.filter(c=>expiryInfo(c,today()).expired).length;$('expired-section').hidden=!expiredCount;$('expired-summary').textContent=`已过期权益（${expiredCount}）`;
 for(const c of visible){
  const expiry=expiryInfo(c,today()),stage=expiryStage(c,today()),icon=iconFor(c),card=el('article','benefit state-'+stage.key);card.setAttribute('aria-label',c.name);card.dataset.cardId=c.id;
  const top=el('div','card-head'),symbol=el('span','service-icon '+icon),heading=el('div','title-group');symbol.append(svgIcon(icon));heading.append(el('h2','',c.name),el('p','',c.provider||labels[c.type]));top.append(symbol,heading,button('编辑','text-button edit',()=>openEditor(c.id)));card.append(top);
  card.append(el('p','expiry-badge',stage.label));
  const deadline=el('div','deadline');if(expiry.days===null){deadline.append(el('strong','long-term',expiry.date));}else{deadline.append(el('strong','',String(Math.abs(expiry.days)).padStart(2,'0')),el('span','',expiry.days<0?'天前到期':expiry.days===0?'今天到期':'天后到期'));}card.append(deadline,el('p','card-date',expiry.days===null?(c.noExpiry?'不用赶时间，慢慢享受':'截止日期待补充'): `截止日期 · ${expiry.date}`));
  if(c.type==='cash'){const cash=el('p','cash-detail');cash.append(el('span','small-label','记录余额'),el('strong','',c.quantity===null?'待核对':`¥${money(c.quantity)}`));card.append(cash);}
  const bottom=el('div','card-bottom');bottom.append(el('span','card-nudge',expiry.expired?'已告一段落，记录还在':c.type==='count'?'有空去动一动，别忘了享受':'留点时间，给喜欢的事'));
  if(!archived)bottom.append(button('打卡','checkin',()=>openCheckin(c.id)));else bottom.append(button('恢复权益','checkin',()=>archive(c.id,false)));card.append(bottom);
  const ev=activeEvents(c.id),latest=ev.map(e=>e.date).sort().at(-1);card.append(el('p','footprint',ev.length?`已记录 ${ev.length} 次 · 最近 ${latest}`:'还没有使用足迹，想记录时再打卡。'));
  const links=el('div','card-links');links.append(button('查看使用日历','text-button',()=>openHistory(c.id)));const reversible=eventsFor(c.id).find(e=>!e.undone&&e.revisionAfter===c.revision);if(!archived&&reversible)links.append(button('撤销上次','text-button',()=>revoke(c.id,reversible.id)));if(!archived)links.append(button('归档','text-button archive-button',()=>archive(c.id,true)));card.append(links);
  if(c.notes||c.start){const details=el('details','card-details');details.append(el('summary','','备注与开卡信息'));if(c.start)details.append(el('p','',`开卡日期：${c.start}`));if(c.notes)details.append(el('p','',c.notes));card.append(details);}
  (expiry.expired&&!archived?$('expired-cards'):$('cards')).append(card);
 }
 $("empty").hidden=visible.length>0;
 const isNew=state.cards.length===0&&!query&&filter==="all"&&!archived;
 $("empty-title").textContent=isNew?"把第一项权益放进来":"这里还没有对应的权益";
 $("empty-description").textContent=isNew?"填入名称和截止日期，集中查看即将到期的权益。":"试试其他类型、搜索关键词，或切换归档视图。";
 $("empty-add").hidden=!isNew;$("load-demo").hidden=!isNew;
 try{$("import-legacy").hidden=!localStorage.getItem("prepaid-card-prototype-v1")||state.cards.some(c=>c.id==="legacy-card");}catch{$("import-legacy").hidden=true;}
}
function openEditor(cardId=null){editing=cardId;const f=$("card-form");f.reset();const c=state.cards.find(c=>c.id===cardId);$("editor-title").textContent=c?"编辑权益":"添加权益";
 $("extra-fields").open=false;
 for(const k of ["name","provider","type","start","end","notes"])f.elements.namedItem(k).value=c?.[k]??(k==="type"?"term":"");
 f.elements.type.disabled=!!c;f.elements.noExpiry.checked=!!c?.noExpiry;f.elements.quantity.value=c?.quantity===null||!c?"":c.type==="cash"?(c.quantity/100).toFixed(2):c.quantity;$("form-error").textContent="";quantityFields();$("editor").showModal();}
function quantityFields(){const f=$("card-form"),type=f.elements.type.value;$("quantity-field").hidden=type!=="cash";$("verified-field").hidden=type!=="cash";$("quantity-label").textContent=type==="cash"?"剩余金额（元）":"剩余次数";f.elements.quantity.step=type==="cash"?"0.01":"1";f.elements.quantity.max=type==="cash"?"99999999.99":"9999";f.elements.quantity.disabled=type!=="cash";f.elements.end.disabled=f.elements.noExpiry.checked;if(f.elements.noExpiry.checked)f.elements.end.value="";}
$("card-form").elements.type.addEventListener("change",quantityFields);$("card-form").elements.noExpiry.addEventListener("change",quantityFields);
$("card-form").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget;try{const old=state.cards.find(c=>c.id===editing),type=old?.type||f.elements.type.value;const quantity=editedQuantity(old,type,f.elements.quantity.value.trim());const c={id:old?.id||id(),name:f.elements.namedItem("name").value.trim(),provider:f.elements.provider.value.trim(),type,quantity,start:f.elements.start.value,end:f.elements.noExpiry.checked?"":f.elements.end.value,noExpiry:f.elements.noExpiry.checked,notes:f.elements.notes.value.trim(),archived:old?.archived||false,verified:type==="term"?"":f.elements.confirmed.checked&&quantity!==null?today():old&&old.quantity===quantity?old.verified:"",revision:(old?.revision||0)+(old&&old.quantity!==quantity?1:0)};if(!validateCard(c))throw Error("请检查名称、日期和余量；开卡时间不能晚于截止时间。");const next={...state,cards:old?state.cards.map(x=>x.id===old.id?c:x):[c,...state.cards]};if(save(next)){$("editor").close();toast(old?"权益已更新":"权益已添加");}}catch(err){$("form-error").textContent=err.message;}});
let recordSource='manual',voiceBlocked=false,formSnapshot=null;
function openCheckin(cardId,date=today()){
 checking=cardId;const c=state.cards.find(c=>c.id===cardId),f=$('checkin-form');f.reset();recordSource='manual';voiceBlocked=false;formSnapshot=localStorage.getItem(KEY);
 f.elements.action.value='use';f.elements.date.value=date;f.elements.date.max=today();f.elements.units.value='1';f.elements.amount.value='';f.elements.debit.checked=c.type==='cash';
 $('checkin-name').textContent=c.name;$('checkin-error').textContent='';voiceController.reset(cardId);checkinFields();$('checkin-dialog').showModal();
}
function buildFormUpdate(){
 const f=$('checkin-form'),c=state.cards.find(c=>c.id===checking),adjust=f.elements.action.value==='adjust'&&c.type==='cash';
 if(adjust){const quantity=parseQuantity((c.type==='cash'?f.elements.amount:f.elements.units).value.trim(),c.type);if(quantity===null)throw Error('请填写校正后的余量。');return createVoiceUpdate(c,{intent:'adjust',quantity,date:f.elements.date.value,transcript:f.elements.note.value.trim()||'手动校正当前余量'},today());}
 return createCheckin(c,{date:f.elements.date.value,note:f.elements.note.value.trim(),debit:c.type==='cash'&&f.elements.debit.checked,amount:f.elements.amount.value.trim()},today());
}
function checkinFields(){
 const c=state.cards.find(c=>c.id===checking);if(!c)return;const f=$('checkin-form'),adjust=f.elements.action.value==='adjust'&&c.type==='cash',debit=!adjust&&c.type==='cash'&&f.elements.debit.checked;
 $('action-field').hidden=c.type!=='cash';$('debit-option').hidden=c.type!=='cash'||adjust;$('debit-label').textContent=c.type==='count'?'同时扣除本次使用次数':'同时记录本次消费金额';
 $('units-field').hidden=true;f.elements.units.disabled=$('units-field').hidden;f.elements.units.required=!$('units-field').hidden;f.elements.units.min=adjust?'0':'1';$('units-label').textContent=adjust?'校正后剩余次数':'本次使用次数';
 $('amount-field').hidden=!(c.type==='cash'&&(adjust||debit));f.elements.amount.disabled=$('amount-field').hidden;f.elements.amount.required=!$('amount-field').hidden;f.elements.amount.min=adjust?'0':'0.01';$('amount-label').textContent=adjust?'校正后余额（元）':'本次消费金额（元）';
 $('checkin-hint').textContent=adjust?'校正只改变当前余量，不计为一次打卡。':c.type!=='cash'?'可选记录本次使用，不改变截止日期。':debit?'确认后扣减本工具中的余量，不操作商家账户。':'只记录打卡，不扣减余量。';
 $('record-preview').hidden=true;$('checkin-submit').disabled=voiceBlocked;$('checkin-submit').textContent=adjust?'确认校正余量':'确认打卡';
 if(voiceBlocked)return;
 try{const result=buildFormUpdate();const format=q=>q===null?'待核对':c.type==='cash'?`¥${money(q)}`:`${q} 次`;$('record-source').textContent=recordSource==='voice'?'语音回填 · 尚未保存':recordSource==='text-demo'?'文字演示回填 · 尚未保存':'手动输入 · 尚未保存';$('record-change').textContent=c.type!=='cash'?'只记录本次使用，截止日期保持不变':`${adjust?'余量校正':'剩余权益'}：${format(c.quantity)} → ${format(result.card.quantity)}`;$('record-preview').hidden=false;}catch{ /* The submit handler presents actionable validation messages. */ }
}
function manualChanged(e){if(e.target.closest('#voice-panel'))return;voiceController.discardDraft();voiceBlocked=false;recordSource='manual';$('voice-error').textContent='';$('voice-status').textContent='以下方内容为准，核对后确认打卡。';$('checkin-error').textContent='';checkinFields();}
$('checkin-form').addEventListener('input',manualChanged);
$('checkin-form').elements.action.addEventListener('change',()=>{const f=$('checkin-form'),c=state.cards.find(c=>c.id===checking);if(f.elements.action.value==='adjust'){f.elements.units.value=c.quantity??'';f.elements.amount.value=c.quantity===null?'':(c.quantity/100).toFixed(2);}else{f.elements.units.value='1';f.elements.amount.value='';}recordSource='manual';voiceBlocked=false;checkinFields();});
$('checkin-dialog').addEventListener('close',()=>voiceController.abort());
let submitting=false;
$('checkin-form').addEventListener('submit',e=>{
 e.preventDefault();if(submitting||voiceBlocked)return;submitting=true;
 try{if(localStorage.getItem(KEY)!==formSnapshot)throw Error('记录已发生变化，请刷新后重新打开，不会覆盖新记录。');const result=buildFormUpdate(),event={...result.event,id:id(),cardId:checking,createdAt:new Date().toISOString(),source:recordSource};
 if(save({...state,cards:state.cards.map(c=>c.id===checking?result.card:c),events:[event,...state.events]})){$('checkin-dialog').close();toast(event.kind==='adjust'?'余量已校正，可撤销。':'已记录本次使用，可在日历查看或撤销。');}
 }catch(err){$('checkin-error').textContent=err.message;}finally{submitting=false;}
});
function revoke(cardId,eventId){try{const c=state.cards.find(c=>c.id===cardId),event=state.events.find(e=>e.id===eventId);const next=undoCheckin(c,event);if(save({...state,cards:state.cards.map(x=>x.id===c.id?next:x),events:state.events.map(x=>x.id===event.id?{...x,undone:true}:x)})){if($("history-dialog").open)renderHistory();toast('已撤销，余量已恢复');}}catch(err){toast(err.message);}}
function openHistory(cardId){historyId=cardId;const recent=activeEvents(cardId).map(e=>e.date).sort().at(-1)||today();selectedDate=recent;calendarMonth=recent.slice(0,7);renderHistory();$("history-dialog").showModal();}
function renderHistory(){
 const c=state.cards.find(c=>c.id===historyId);$("history-name").textContent=c.name;const events=eventsFor(c.id),monthEvents=events.filter(e=>!e.undone&&e.kind!=='adjust'&&e.date.startsWith(calendarMonth));const [year,month]=calendarMonth.split('-');$("cal-month").textContent=`${Number(year)} 年 ${Number(month)} 月`;$("cal-summary").textContent=`本月使用 ${new Set(monthEvents.map(e=>e.date)).size} 天 · 共 ${monthEvents.length} 条使用记录${state.demo?'（示例）':''}`;
 const grid=$("cal-grid");grid.replaceChildren();grid.setAttribute('aria-label',`${Number(year)}年${Number(month)}月日期`);
 for(const date of monthCells(calendarMonth)){if(!date){grid.append(el('span','calendar-blank'));continue;}const daily=events.filter(e=>e.date===date),count=daily.filter(e=>!e.undone&&e.kind!=='adjust').length,adjustments=daily.filter(e=>!e.undone&&e.kind==='adjust').length;const day=button(String(Number(date.slice(-2))),'calendar-day'+(date===today()?' today':'')+(date===selectedDate?' selected':'')+(count?' has-record':adjustments?' has-correction':daily.length?' revoked-record':''),()=>{selectedDate=date;renderHistory();});day.setAttribute('aria-label',`${date}，${count} 条使用记录${adjustments?`，${adjustments} 条余量校正`:daily.length&&!count?'，已有记录撤销':''}`);day.setAttribute('aria-pressed',String(date===selectedDate));grid.append(day);}
 $("cal-date").textContent=`${selectedDate} 的记录`;$("cal-add").disabled=c.archived||selectedDate>today()||(c.start&&selectedDate<c.start)||(c.end&&selectedDate>c.end);
 const list=$("history-list");list.replaceChildren();const daily=events.filter(e=>e.date===selectedDate);if(!daily.length)list.append(el('p','hint','这一天还没有记录。不需要为了填满日历而打卡。'));
 for(const e of daily){const item=el('div','history-item'+(e.undone?' undone':''));const amount=q=>q===null?'待核对':c.type==='cash'?`¥${money(q)}`:`${q} 次`;item.append(el('p','meta',(e.undone?'已撤销':'已记录')+(e.source==='text-demo'?' · 文字演示':e.source==='voice'?' · 语音确认':'')),el('p','',e.kind==='adjust'?`余量校正：${amount(e.previousQuantity)} → ${amount(e.afterQuantity)}`:e.debit?(c.type==='cash'?`记录消费 ¥${money(e.debit)}`:`使用并扣除 ${e.debit} 次`):'已打卡，未扣减余量'));if(e.note)item.append(el('p','',e.note));if(!e.undone){const canUndo=c.revision===e.revisionAfter,b=button(canUndo?'撤销这次记录':'后续余量或记录已改变','text-button',()=>revoke(c.id,e.id));b.disabled=!canUndo;item.append(b);}list.append(item);}
}
function changeCalendar(delta){calendarMonth=shiftMonth(calendarMonth,delta);const dates=activeEvents(historyId).filter(e=>e.date.startsWith(calendarMonth)).map(e=>e.date).sort();selectedDate=dates.at(-1)||(today().startsWith(calendarMonth)?today():calendarMonth+'-01');renderHistory();}
$("cal-prev").addEventListener('click',()=>changeCalendar(-1));$("cal-next").addEventListener('click',()=>changeCalendar(1));$("cal-add").addEventListener('click',()=>{$("history-dialog").close();openCheckin(historyId,selectedDate);});
function archive(cardId,archived){if(save({...state,cards:state.cards.map(c=>c.id===cardId?{...c,archived}:c)}))toast(archived?"已归档，可在归档视图恢复":"已恢复");}
function sample(){const base={provider:"示例服务方",start:"",end:"",noExpiry:false,verified:"",notes:"",archived:false,revision:0};const future=new Date();future.setDate(future.getDate()+21);const end=`${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,"0")}-${String(future.getDate()).padStart(2,"0")}`;return {demo:true,events:[],cards:[{...base,id:id(),name:"骑行 10 次卡",type:"count",quantity:8,end,notes:"示例：每次骑行限 30 分钟。"},{...base,id:id(),name:"健身月卡",type:"term",quantity:null,end,notes:"示例：健身后留下一句话，记录自己的节奏。"},{...base,id:id(),name:"常去的小餐馆",type:"cash",quantity:28000,noExpiry:true,notes:"示例储值卡，金额并非真实余额。"}]};}
$("load-demo").addEventListener("click",()=>{if(state.cards.length||locked)return;save(sample());});
$("leave-demo").addEventListener("click",()=>{if(confirm("清空本轮示例卡片和示例打卡，开始记录自己的权益？"))save({cards:[],events:[],demo:false});});
$("import-legacy").addEventListener("click",()=>{try{const old=JSON.parse(localStorage.getItem("prepaid-card-prototype-v1"));if(!old||typeof old.provider!=="string"||!(old.remaining===null||(Number.isInteger(old.remaining)&&old.remaining>=0&&old.remaining<=9999)))throw Error("上版记录格式不完整，未导入。");if(state.demo&&state.cards.length&&!confirm("导入将替换当前示例清单。上版单卡原数据会保留，继续吗？"))return;const c={id:"legacy-card",name:"骑行次卡",provider:old.provider,type:"count",quantity:old.remaining,start:old.start||"",end:old.end||"",noExpiry:false,verified:old.verified||"",notes:(old.instructions||"").slice(0,300),archived:false,revision:0};if(!validateCard(c))throw Error("上版日期或字段无效，未导入。");if(save({cards:state.demo?[c]:[c,...state.cards],events:state.demo?[]:state.events,demo:false}))toast("上版单卡已导入；原数据仍保留");}catch(err){toast(err.message);}});
for(const b of document.querySelectorAll("[data-close]"))b.addEventListener("click",()=>b.closest("dialog").close());
for(const b of document.querySelectorAll("[data-filter]"))b.addEventListener("click",()=>{filter=b.dataset.filter;for(const t of document.querySelectorAll("[data-filter]")){t.classList.toggle("selected",t===b);t.setAttribute("aria-pressed",String(t===b));}render();});
const voiceController=setupVoice({getCard:cardId=>state.cards.find(c=>c.id===cardId),today,
 onPending:()=>{voiceBlocked=true;$('checkin-error').textContent='';checkinFields();},
 onError:()=>{voiceBlocked=true;checkinFields();},
 onRecognized:(command,source)=>{const f=$('checkin-form'),c=state.cards.find(c=>c.id===checking);f.elements.action.value=command.intent==='adjust'?'adjust':'use';f.elements.date.value=command.date;f.elements.note.value=command.transcript;f.elements.debit.checked=c.type==='cash'&&command.intent==='consume';f.elements.units.value=String(command.intent==='adjust'&&c.type==='count'?command.quantity:command.units??1);f.elements.amount.value=(command.intent==='adjust'&&c.type==='cash'?command.quantity:command.amount)===undefined?'':((command.intent==='adjust'?command.quantity:command.amount)/100).toFixed(2);recordSource=source;voiceBlocked=false;$('checkin-error').textContent='';checkinFields();}
});
$("search").addEventListener("input",render);$("show-archived").addEventListener("change",render);$("add").addEventListener("click",()=>openEditor());$("empty-add").addEventListener("click",()=>openEditor());render();

$('spotlight-open').addEventListener('click',()=>{if(!featuredId){openEditor();return;}const targetId=featuredId;filter='all';$('search').value='';$('show-archived').checked=false;for(const t of document.querySelectorAll('[data-filter]')){t.classList.toggle('selected',t.dataset.filter==='all');t.setAttribute('aria-pressed',String(t.dataset.filter==='all'));}render();const card=[...$('cards').children].find(c=>c.dataset.cardId===targetId);if(card){card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});card.classList.add('highlight');setTimeout(()=>card.classList.remove('highlight'),1800);}});
