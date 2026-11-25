import {validateCard,validateState,isLegacyAccounting,createCheckin,undoCheckin,monthCells,shiftMonth} from "./domain.mjs?v=13";
import {setupVoice} from './voice-ui.mjs?v=13';
import {expiryInfo,sortByExpiry,overviewFor,expiryStage} from './expiry.mjs?v=13';
const $=id=>document.getElementById(id), KEY="prepaid-manager-records-v2";
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const id=()=>crypto.randomUUID(), labels={term:"期限会员",count:"次数卡",cash:"储值卡"};
let state={cards:[],events:[],demo:false}, filter="all", editing=null, checking=null, historyId=null, locked=false, calendarMonth=today().slice(0,7), selectedDate=today();
try { const raw=localStorage.getItem(KEY); if(raw){const loaded=JSON.parse(raw);if(!validateState(loaded))throw Error();state=loaded;} } catch {locked=true;$("storage-warning").hidden=false;}
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
 $('summary').textContent=archived?'已归档权益 · 可恢复到当前清单':'最近到期的，排在前面 · 不需要维护次数和余额';
 $('demo-banner').hidden=!state.demo;$('cards').replaceChildren();$('expired-cards').replaceChildren();const expiredCount=archived?0:visible.filter(c=>expiryInfo(c,today()).expired).length;$('expired-section').hidden=!expiredCount;$('expired-summary').textContent=`已过期权益（${expiredCount}）`;
 for(const c of visible){
  const expiry=expiryInfo(c,today()),stage=expiryStage(c,today()),icon=iconFor(c),card=el('article','benefit state-'+stage.key);card.setAttribute('aria-label',c.name);card.dataset.cardId=c.id;
  const top=el('div','card-head'),symbol=el('span','service-icon '+icon),heading=el('div','title-group');symbol.append(svgIcon(icon));heading.append(el('h2','',c.name),el('p','',c.provider||labels[c.type]));top.append(symbol,heading,button('编辑','text-button edit',()=>openEditor(c.id)));card.append(top);
  card.append(el('p','expiry-badge',stage.label));
  const deadline=el('div','deadline');if(expiry.days===null){deadline.append(el('strong','long-term',expiry.date));}else{deadline.append(el('strong','',String(Math.abs(expiry.days)).padStart(2,'0')),el('span','',expiry.days<0?'天前到期':expiry.days===0?'今天到期':'天后到期'));}card.append(deadline,el('p','card-date',expiry.days===null?(c.noExpiry?'不用赶时间，慢慢享受':'截止日期待补充'): `截止日期 · ${expiry.date}`));
  const bottom=el('div','card-bottom');bottom.append(el('span','card-nudge',expiry.expired?'已告一段落，记录还在':c.type==='count'?'有空去动一动，别忘了享受':'留点时间，给喜欢的事'));
  if(!archived)bottom.append(button('打卡','checkin',()=>openCheckin(c.id)));else bottom.append(button('恢复权益','checkin',()=>archive(c.id,false)));card.append(bottom);
  const ev=activeEvents(c.id),latest=ev.map(e=>e.date).sort().at(-1);card.append(el('p','footprint',ev.length?`已记录 ${ev.length} 次 · 最近 ${latest}`:'还没有使用足迹，想记录时再打卡。'));
  const links=el('div','card-links');links.append(button('查看使用日历','text-button',()=>openHistory(c.id)));const reversible=eventsFor(c.id).find(e=>!e.undone&&!isLegacyAccounting(e)&&e.revisionAfter===c.revision);if(!archived&&reversible)links.append(button('撤销上次','text-button',()=>revoke(c.id,reversible.id)));if(!archived)links.append(button('归档','text-button archive-button',()=>archive(c.id,true)));card.append(links);
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
let editorSnapshot=null;
function openEditor(cardId=null){editing=cardId;editorSnapshot=localStorage.getItem(KEY);const f=$("card-form");f.reset();const c=state.cards.find(c=>c.id===cardId);$("editor-title").textContent=c?"编辑权益":"添加权益";
 $("extra-fields").open=false;
 for(const k of ["name","provider","type","start","end","notes"])f.elements.namedItem(k).value=c?.[k]??(k==="type"?"term":"");
 f.elements.type.disabled=!!c;f.elements.noExpiry.checked=!!c?.noExpiry;$("form-error").textContent="";dateFields();$("editor").showModal();}
function dateFields(){const f=$("card-form");f.elements.end.disabled=f.elements.noExpiry.checked;if(f.elements.noExpiry.checked)f.elements.end.value="";}
$("card-form").elements.noExpiry.addEventListener("change",dateFields);
$("card-form").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget;try{if(localStorage.getItem(KEY)!==editorSnapshot)throw Error('记录已发生变化，请重新打开编辑。');const old=state.cards.find(c=>c.id===editing);const c={...old,id:old?.id||id(),name:f.elements.namedItem("name").value.trim(),provider:f.elements.provider.value.trim(),type:old?.type||f.elements.type.value,start:f.elements.start.value,end:f.elements.noExpiry.checked?"":f.elements.end.value,noExpiry:f.elements.noExpiry.checked,notes:f.elements.notes.value.trim(),archived:old?.archived||false,revision:old?old.revision+1:0};if(!validateCard(c))throw Error("请检查名称、日期；开卡时间不能晚于截止时间。");const next={...state,cards:old?state.cards.map(x=>x.id===old.id?c:x):[c,...state.cards]};if(save(next)){$("editor").close();toast(old?"权益已更新":"权益已添加");}}catch(err){$("form-error").textContent=err.message;}});
let recordSource='manual',voiceBlocked=false,formSnapshot=null;
function openCheckin(cardId,date=today()){
 checking=cardId;const c=state.cards.find(c=>c.id===cardId),f=$('checkin-form');f.reset();recordSource='manual';voiceBlocked=false;formSnapshot=localStorage.getItem(KEY);
 f.elements.date.value=date;f.elements.date.max=today();
 $('checkin-name').textContent=c.name;$('checkin-error').textContent='';voiceController.reset(cardId);checkinFields();$('checkin-dialog').showModal();
}
function buildFormUpdate(){const f=$('checkin-form'),c=state.cards.find(c=>c.id===checking);return createCheckin(c,{date:f.elements.date.value,note:f.elements.note.value.trim()},today());}
function checkinFields(){
 if(!state.cards.some(c=>c.id===checking))return;
 $('checkin-hint').textContent='只记录使用足迹，不维护次数或金额，截止日期保持不变。';
 $('record-preview').hidden=true;$('checkin-submit').disabled=voiceBlocked;
 if(voiceBlocked)return;
 try{buildFormUpdate();$('record-source').textContent=recordSource==='voice'?'语音回填 · 尚未保存':recordSource==='text-demo'?'文字演示回填 · 尚未保存':'手动输入 · 尚未保存';$('record-change').textContent='确认后记录这次使用，权益截止日期保持不变';$('record-preview').hidden=false;}catch{}
}
function manualChanged(e){if(e.target.closest('#voice-panel'))return;voiceController.discardDraft();voiceBlocked=false;recordSource='manual';$('voice-error').textContent='';$('voice-status').textContent='以下方内容为准，核对后确认打卡。';$('checkin-error').textContent='';checkinFields();}
$('checkin-form').addEventListener('input',manualChanged);
$('checkin-dialog').addEventListener('close',()=>voiceController.abort());
let submitting=false;
$('checkin-form').addEventListener('submit',e=>{
 e.preventDefault();if(submitting||voiceBlocked)return;submitting=true;
 try{if(localStorage.getItem(KEY)!==formSnapshot)throw Error('记录已发生变化，请刷新后重新打开，不会覆盖新记录。');const result=buildFormUpdate(),event={...result.event,id:id(),cardId:checking,createdAt:new Date().toISOString(),source:recordSource};
 if(save({...state,cards:state.cards.map(c=>c.id===checking?result.card:c),events:[event,...state.events]})){$('checkin-dialog').close();toast('已记录本次使用，可在日历查看或撤销。');}
 }catch(err){$('checkin-error').textContent=err.message;}finally{submitting=false;}
});
function revoke(cardId,eventId){try{const c=state.cards.find(c=>c.id===cardId),event=state.events.find(e=>e.id===eventId);const next=undoCheckin(c,event);if(save({...state,cards:state.cards.map(x=>x.id===c.id?next:x),events:state.events.map(x=>x.id===event.id?{...x,undone:true}:x)})){if($("history-dialog").open)renderHistory();toast('已撤销这次使用记录');}}catch(err){toast(err.message);}}
function openHistory(cardId){historyId=cardId;const recent=activeEvents(cardId).map(e=>e.date).sort().at(-1)||today();selectedDate=recent;calendarMonth=recent.slice(0,7);renderHistory();$("history-dialog").showModal();}
function renderHistory(){
 const c=state.cards.find(c=>c.id===historyId);$("history-name").textContent=c.name;const events=eventsFor(c.id),monthEvents=events.filter(e=>!e.undone&&e.kind!=='adjust'&&e.date.startsWith(calendarMonth));const [year,month]=calendarMonth.split('-');$("cal-month").textContent=`${Number(year)} 年 ${Number(month)} 月`;$("cal-summary").textContent=`本月使用 ${new Set(monthEvents.map(e=>e.date)).size} 天 · 共 ${monthEvents.length} 条使用记录${state.demo?'（示例）':''}`;
 const grid=$("cal-grid");grid.replaceChildren();grid.setAttribute('aria-label',`${Number(year)}年${Number(month)}月日期`);
 for(const date of monthCells(calendarMonth)){if(!date){grid.append(el('span','calendar-blank'));continue;}const daily=events.filter(e=>e.date===date),count=daily.filter(e=>!e.undone&&e.kind!=='adjust').length,adjustments=daily.filter(e=>!e.undone&&e.kind==='adjust').length;const day=button(String(Number(date.slice(-2))),'calendar-day'+(date===today()?' today':'')+(date===selectedDate?' selected':'')+(count?' has-record':adjustments?' has-correction':daily.length?' revoked-record':''),()=>{selectedDate=date;renderHistory();});day.setAttribute('aria-label',`${date}，${count} 条使用记录${adjustments?`，${adjustments} 条旧版校正记录`:daily.length&&!count?'，已有记录撤销':''}`);day.setAttribute('aria-pressed',String(date===selectedDate));grid.append(day);}
 $("cal-date").textContent=`${selectedDate} 的记录`;$("cal-add").disabled=c.archived||selectedDate>today()||(c.start&&selectedDate<c.start)||(c.end&&selectedDate>c.end);
 const list=$("history-list");list.replaceChildren();const daily=events.filter(e=>e.date===selectedDate);if(!daily.length)list.append(el('p','hint','这一天还没有记录。不需要为了填满日历而打卡。'));
 for(const e of daily){const item=el('div','history-item'+(e.undone?' undone':''));const legacy=isLegacyAccounting(e);item.append(el('p','meta',(e.undone?'已撤销':'已记录')+(e.source==='text-demo'?' · 文字演示':e.source==='voice'?' · 语音确认':'')),el('p','',legacy?'旧版记录（只读，不再维护余量）':'使用打卡'));if(e.note)item.append(el('p','',e.note));if(!e.undone&&!legacy){const canUndo=c.revision===e.revisionAfter,b=button(canUndo?'撤销这次记录':'后续权益或记录已改变','text-button',()=>revoke(c.id,e.id));b.disabled=!canUndo;item.append(b);}list.append(item);}

}
function changeCalendar(delta){calendarMonth=shiftMonth(calendarMonth,delta);const dates=activeEvents(historyId).filter(e=>e.date.startsWith(calendarMonth)).map(e=>e.date).sort();selectedDate=dates.at(-1)||(today().startsWith(calendarMonth)?today():calendarMonth+'-01');renderHistory();}
$("cal-prev").addEventListener('click',()=>changeCalendar(-1));$("cal-next").addEventListener('click',()=>changeCalendar(1));$("cal-add").addEventListener('click',()=>{$("history-dialog").close();openCheckin(historyId,selectedDate);});
function archive(cardId,archived){if(save({...state,cards:state.cards.map(c=>c.id===cardId?{...c,archived,revision:c.revision+1}:c)}))toast(archived?"已归档，可在归档视图恢复":"已恢复");}
function sample(){const base={provider:"示例服务方",start:"",end:"",noExpiry:false,notes:"",archived:false,revision:0};const deadline=days=>{const date=new Date();date.setDate(date.getDate()+days);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;};return {demo:true,events:[],cards:[{...base,id:id(),name:"骑行次卡",type:"count",end:deadline(3),notes:"只关注截止日期，不维护剩余次数。"},{...base,id:id(),name:"健身月卡",type:"term",end:deadline(7),notes:"健身后留下一句话，记录自己的节奏。"},{...base,id:id(),name:"常去的小餐馆",type:"cash",noExpiry:true,notes:"只记录权益与期限，不维护余额。"}]};}
$("load-demo").addEventListener("click",()=>{if(state.cards.length||locked)return;save(sample());});
$("leave-demo").addEventListener("click",()=>{if(confirm("清空本轮示例卡片和示例打卡，开始记录自己的权益？"))save({cards:[],events:[],demo:false});});
$("import-legacy").addEventListener("click",()=>{try{const old=JSON.parse(localStorage.getItem("prepaid-card-prototype-v1"));if(!old||typeof old.provider!=="string"||!(old.remaining===null||(Number.isInteger(old.remaining)&&old.remaining>=0&&old.remaining<=9999)))throw Error("上版记录格式不完整，未导入。");if(state.demo&&state.cards.length&&!confirm("导入将替换当前示例清单。上版单卡原数据会保留，继续吗？"))return;const c={id:"legacy-card",name:"骑行次卡",provider:old.provider,type:"count",start:old.start||"",end:old.end||"",noExpiry:false,notes:(old.instructions||"").slice(0,300),archived:false,revision:0};if(!validateCard(c))throw Error("上版日期或字段无效，未导入。");if(save({cards:state.demo?[c]:[c,...state.cards],events:state.demo?[]:state.events,demo:false}))toast("上版单卡已导入；原数据仍保留");}catch(err){toast(err.message);}});
for(const b of document.querySelectorAll("[data-close]"))b.addEventListener("click",()=>b.closest("dialog").close());
for(const b of document.querySelectorAll("[data-filter]"))b.addEventListener("click",()=>{filter=b.dataset.filter;for(const t of document.querySelectorAll("[data-filter]")){t.classList.toggle("selected",t===b);t.setAttribute("aria-pressed",String(t===b));}render();});
const voiceController=setupVoice({getCard:cardId=>state.cards.find(c=>c.id===cardId),today,
 onPending:()=>{voiceBlocked=true;$('checkin-error').textContent='';checkinFields();},
 onError:()=>{voiceBlocked=true;checkinFields();},
 onRecognized:(command,source)=>{const f=$('checkin-form');f.elements.date.value=command.date;f.elements.note.value=command.transcript;recordSource=source;voiceBlocked=false;$('checkin-error').textContent='';checkinFields();}
});
$("search").addEventListener("input",render);$("show-archived").addEventListener("change",render);$("add").addEventListener("click",()=>openEditor());$("empty-add").addEventListener("click",()=>openEditor());render();

$('spotlight-open').addEventListener('click',()=>{if(!featuredId){openEditor();return;}const targetId=featuredId;filter='all';$('search').value='';$('show-archived').checked=false;for(const t of document.querySelectorAll('[data-filter]')){t.classList.toggle('selected',t.dataset.filter==='all');t.setAttribute('aria-pressed',String(t.dataset.filter==='all'));}render();const card=[...$('cards').children].find(c=>c.dataset.cardId===targetId);if(card){card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});card.classList.add('highlight');setTimeout(()=>card.classList.remove('highlight'),1800);}});
