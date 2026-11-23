export const TYPES=["term","count","cash"];
// Counts are retained for compatibility, but the expiry-first editor never rewrites them.
export function editedQuantity(card,type,input){return type==='count'?(card?.quantity??null):parseQuantity(input,type);}
export function validDate(s){if(s==="")return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}
export function parseQuantity(text,type){if(type==="term"||text.trim()==="")return null;if(type==="count"){if(!/^\d+$/.test(text)||Number(text)>9999)throw Error("次数需为 0 到 9999 的整数。");return Number(text);}if(!/^\d+(\.\d{1,2})?$/.test(text))throw Error("金额需为非负数字，最多两位小数。");const [whole,dec=""]=text.split(".");const cents=Number(whole)*100+Number(dec.padEnd(2,"0"));if(!Number.isSafeInteger(cents)||cents>9999999999)throw Error("金额过大，请核对。");return cents;}
export function validateCard(c){return c&&typeof c.id==="string"&&c.id.length>0&&typeof c.name==="string"&&c.name.trim().length>0&&c.name.length<=40&&typeof c.provider==="string"&&c.provider.length<=40&&TYPES.includes(c.type)&&(c.quantity===null||(Number.isSafeInteger(c.quantity)&&c.quantity>=0&&c.quantity<=(c.type==="count"?9999:9999999999)))&&(c.type!=="term"||c.quantity===null)&&[c.start,c.end,c.verified].every(s=>typeof s==="string"&&validDate(s))&&(!c.start||!c.end||c.start<=c.end)&&typeof c.noExpiry==="boolean"&&(!c.noExpiry||c.end==="")&&typeof c.notes==="string"&&c.notes.length<=300&&typeof c.archived==="boolean"&&Number.isInteger(c.revision)&&c.revision>=0;}
export function createCheckin(card,input,today){
 if(card.archived)throw Error("请先恢复这项权益，再记录使用。");
 if(!input.date||!validDate(input.date)||input.date>today)throw Error("请选择今天或过去的实际使用日期。");
 if((card.start&&input.date<card.start)||(card.end&&input.date>card.end))throw Error("使用日期超出已记录的有效期，请先核对日期或卡片有效期。");
 if(typeof input.note!=="string"||input.note.length>160)throw Error("使用备注最多 160 字。");
 let debit=0;
 if(input.debit&&card.type!=="term"){
  if(card.quantity===null)throw Error("扣减前请先填写并核对剩余权益，也可以选择只打卡。");
  debit=card.type==="count"?(input.units??1):parseQuantity(input.amount||"", "cash");
  if(card.type==='count'&&(!Number.isInteger(debit)||debit<1||debit>9999))throw Error('使用次数需为正整数。');
  if(debit===null||debit<=0)throw Error("请填写大于零的实际消费金额。");
  if(debit>card.quantity)throw Error("本次扣减超过已记录的剩余权益，请先核对或校正。");
 }
 const next={...card,quantity:debit?card.quantity-debit:card.quantity,revision:card.revision+1};
 return {card:next,event:{date:input.date,note:input.note,debit,previousQuantity:card.quantity,afterQuantity:next.quantity,revisionAfter:next.revision,undone:false}};
}
export function undoCheckin(card,event){if(event.undone||card.revision!==event.revisionAfter)throw Error("后续记录或余量已改变，无法直接撤销这条。可在编辑中核对并校正余量。");return {...card,quantity:event.previousQuantity,verified:event.previousVerified??card.verified,revision:card.revision+1};}

export function quickChoice(card,events,today){
 const already=events.some(e=>e.cardId===card.id&&e.date===today&&!e.undone&&e.kind!=='adjust');
 const outside=(card.start&&today<card.start)||(card.end&&today>card.end);
 const debit=card.type==='count'&&card.quantity!==null&&card.quantity>0;
 return {already,disabled:!!(already||outside||card.archived),debit,label:already?'今日已打卡 ✓':outside?'不在记录有效期内':debit?'今日打卡 · 扣 1 次':card.type==='count'?'今日打卡 · 不扣次':'今日一键打卡'};
}
export function shiftMonth(month,delta){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
export function monthCells(month){const [y,m]=month.split('-').map(Number);const offset=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7;const length=new Date(Date.UTC(y,m,0)).getUTCDate();return [...Array(offset).fill(null),...Array.from({length},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];}
