import {parseQuantity,createCheckin,validateCard,validDate} from './domain.mjs?v=12';

const DIGITS={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
const NUM='[0-9零〇一二两三四五六七八九十百千万点.]+';
export function spokenNumber(text){
 if(/^\d+(\.\d+)?$/.test(text))return Number(text);
 if(text.includes('点')){const parts=text.split('点');if(parts.length!==2||!parts[1])throw Error('没有听清数字，请重新说。');const decimals=[...parts[1]].map(c=>/\d/.test(c)?c:DIGITS[c]);if(decimals.some(v=>v===undefined))throw Error('没有听清小数。');return Number(`${spokenNumber(parts[0]||'零')}.${decimals.join('')}`);}
 if(!text||![...text].every(c=>c in DIGITS||'十百千万'.includes(c)))throw Error('没有听清数字，请重新说。');
 if(/[百千万][一二两三四五六七八九]$/.test(text))throw Error('请把数值说完整，例如“一百二十”或“一百零二”。');
 if(!/[十百千万]/.test(text))return Number([...text].map(c=>DIGITS[c]).join(''));
 let total=0,section=0,current=0;
 for(const c of text){if(c in DIGITS){current=DIGITS[c];continue;}const unit={十:10,百:100,千:1000,万:10000}[c];if(unit===10000){total+=(section+current)*unit;section=0;current=0;}else{section+=(current||1)*unit;current=0;}}
 return total+section+current;
}
export function spokenMoney(text){
 text=text.replace(/钱$|整$/g,'').replace(/块/g,'元').replace(/毛/g,'角');
 const n=NUM;let match;
 if((match=text.match(new RegExp(`^(${n})元(${n})角(?:(${n})分)?$`)))){const whole=spokenNumber(match[1]),jiao=spokenNumber(match[2]),fen=match[3]?spokenNumber(match[3]):0;if(!Number.isInteger(whole)||!Number.isInteger(jiao)||jiao>9||!Number.isInteger(fen)||fen>9)throw Error('角和分没有听清，请重新说。');return parseQuantity((whole+jiao/10+fen/100).toFixed(2),'cash');}
 if((match=text.match(new RegExp(`^(${n})元(${n})分$`)))){const whole=spokenNumber(match[1]),fen=spokenNumber(match[2]);if(!Number.isInteger(whole)||!Number.isInteger(fen)||fen>9)throw Error('分的金额没有听清。');return parseQuantity((whole+fen/100).toFixed(2),'cash');}
 if((match=text.match(new RegExp(`^(${n})元(${n})(?:角)?$`)))){const whole=spokenNumber(match[1]),jiao=spokenNumber(match[2]);if(!Number.isInteger(whole)||!Number.isInteger(jiao)||jiao>9)throw Error('请把角的金额说完整。');return parseQuantity((whole+jiao/10).toFixed(2),'cash');}
 if((match=text.match(new RegExp(`^(${n})角(?:(${n})分)?$`)))){const jiao=spokenNumber(match[1]),fen=match[2]?spokenNumber(match[2]):0;if(!Number.isInteger(jiao)||!Number.isInteger(fen)||fen>9)throw Error('金额没有听清。');return parseQuantity((jiao/10+fen/100).toFixed(2),'cash');}
 if((match=text.match(new RegExp(`^(${n})分$`))))return parseQuantity((spokenNumber(match[1])/100).toFixed(2),'cash');
 text=text.replace(/元$/,'');const value=spokenNumber(text);if(!Number.isFinite(value)||Math.abs(value*100-Math.round(value*100))>1e-6)throw Error('金额最多支持到分，请重新说。');return parseQuantity(value.toFixed(2),'cash');
}
function dateFromText(text,today){
 if(/明天|后天|下周|下个月|上周|上个月|星期|周[一二三四五六日天]/.test(text))throw Error('目前语音支持今天、昨天、前天或明确日期；其他日期请用日历补记。');
 let date=today;const matches=[...text.matchAll(/(20\d{2})[-年](\d{1,2})[-月](\d{1,2})[日号]?/g)];
 if(matches.length>1||(/昨天/.test(text)&&/前天/.test(text))||(/今天/.test(text)&&/昨天|前天/.test(text)))throw Error('这句话包含多个日期，请一次只记一天。');
 if(matches.length){const m=matches[0];date=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;}
 else if(/昨天|前天/.test(text)){const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(/前天/.test(text)?2:1));date=d.toISOString().slice(0,10);}
 else {const m=text.match(/(\d{1,2})月(\d{1,2})[日号]/);if(m)date=`${today.slice(0,4)}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
 if(!validDate(date)||date>today)throw Error('使用日期无效或在未来，请重新说。');return date;
}
const EXPENSE='消费|花了|花费|扣了|支付了|支出了';
const MONEY=`${NUM}(?:元|块)(?:${NUM}(?:角|毛)(?:${NUM}分)?|${NUM}分|[0-9零〇一二两三四五六七八九](?![0-9零〇一二两三四五六七八九十百千万个次杯份瓶人公里分钟小时年月日号]))?(?:钱|整)?|${NUM}(?:角|毛)(?:${NUM}分)?|${NUM}分(?!钟)`;
const ITEM='吃饭|早饭|午饭|晚饭|饮料|咖啡|奶茶|豆浆|包子|早餐|午餐|晚餐|饭钱|餐费|车费|停车费|打车|甜点|小吃|零食|水果|面包|酒水|服务费|电影票|门票|洗车|美甲';
function expenseAmounts(text){
 const amounts=[];
 const add=(start,end,value)=>{if(!amounts.some(a=>start<a.end&&end>a.start))amounts.push({start,end,value});};
 for(const m of text.matchAll(new RegExp(MONEY,'g'))){if(/(?:评分|打分|得分)(?:是|为)?$/.test(text.slice(0,m.index)))continue;add(m.index,m.index+m[0].length,spokenMoney(m[0]));}
 // Bare numbers need an expense verb or a named item, so times and table numbers are not added.
 for(const m of text.matchAll(new RegExp(`(?:${EXPENSE})(?:了|有|是|为|共计|总共|共)*(${NUM})(?![0-9零〇一二两三四五六七八九十百千万点.])`,'g'))){const start=m.index+m[0].length-m[1].length;const tail=text.slice(start+m[1].length);if(/^(?:元|块|角|毛|分|个|次|杯|份|瓶|人|公里|分钟|小时|年|月|日|号|楼|折|%)/.test(tail))continue;add(start,start+m[1].length,spokenMoney(m[1]));}
 for(const m of text.matchAll(new RegExp(`(?:${ITEM}|另外|还有|加上)(?:消费|花了|花费|用了|是|为|共|钱|了)*(${NUM})(?=$|[，,。；;、！!]|元|块|${ITEM})`,'g'))){const start=m.index+m[0].length-m[1].length;add(start,start+m[1].length,spokenMoney(m[1]));}
 for(const m of text.matchAll(new RegExp(`(?:一共|总共|合计|总计|总额)(?:消费|花了|为|是|了)?(${NUM})(?=$|[，,。；;、！!]|元|块)`,'g'))){const start=m.index+m[0].length-m[1].length;add(start,start+m[1].length,spokenMoney(m[1]));}
 amounts.sort((a,b)=>a.start-b.start);
 if(!amounts.length)throw Error('金额没有听清，可以说“吃饭花了20，饮料4”。');
 for(const m of text.matchAll(new RegExp(NUM,'g'))){
  if(m.index<amounts[0].start||amounts.some(a=>m.index<a.end&&m.index+m[0].length>a.start))continue;
  const tail=text.slice(m.index+m[0].length),prefix=text.slice(0,m.index);
  if((!tail||/^[，,。；;、！!]/.test(tail))&&!/(?:评分|打分|订单号|电话)(?:是|为)?$/.test(prefix))throw Error('还有一个数值未能确定用途，请注明消费项目、金额单位，或直接修改下方金额。');
 }
 if(/原价|优惠|折扣|实付|找零|应付|折后|满减/.test(text)&&amounts.length>1)throw Error('听到了优惠或实付信息，请直接说最终实际消费金额，避免重复相加。');
 const totals=amounts.filter(a=>/(?:一共|总共|合计|总计|总额)(?:消费|花了|为|是|了)?$/.test(text.slice(0,a.start)));
 const breakdown=text.match(/其中|包含|包括/);
 if(breakdown){
  const before=amounts.filter(a=>a.end<=breakdown.index),parts=amounts.filter(a=>a.start>=breakdown.index+breakdown[0].length);
  if(before.length!==1||!parts.length||totals.some(a=>a!==before[0]))throw Error('总额和明细关系尚不明确，请先说消费总额，再说“其中”各项金额。');
  const amount=before[0].value,sum=parts.reduce((n,a)=>n+a.value,0);
  if(amount<=0||parts.some(a=>a.value<=0)||!Number.isSafeInteger(sum))throw Error('消费总额和各项明细应大于零。');
  if(sum>amount)throw Error(`明细合计 ${(sum/100).toFixed(2)} 元超过总额 ${(amount/100).toFixed(2)} 元，请核对后修改。`);
  return {amount,amounts:parts.map(a=>a.value),hasTotal:true,remainder:amount-sum};
 }
 if(totals.length>1)throw Error('听到了多个合计金额，请核对后只保留一个合计。');
 const parts=amounts.filter(a=>!totals.includes(a));
 const sum=parts.reduce((n,a)=>n+a.value,0);
 if(totals.length&&parts.length&&totals[0].value!==sum)throw Error('各项金额与合计不一致，请核对下方金额或重新说。');
 const amount=totals.length?totals[0].value:sum;
 if(!Number.isSafeInteger(amount)||amount<=0||amount>9999999999||parts.some(a=>a.value<=0))throw Error('消费金额应大于零，且不能超过金额上限。');
 return {amount,amounts:parts.length?parts.map(a=>a.value):[amount],hasTotal:totals.length>0,remainder:0};
}
function amountAfter(text,match){
 const tail=text.slice(match.index+match[0].length).replace(/^[了有是为到共计总共]+/,'');
 const m=tail.match(new RegExp(`^(${NUM}(?:元|块|角|毛|分)?(?:${NUM}(?:角|毛|分)?)?(?:${NUM}分)?)(钱|整)?`));
 if(!m)throw Error('金额没有听清，请说“消费了三十五元”或“余额还剩两百元”。');
 const rest=tail.slice(m[0].length);if(new RegExp(MONEY).test(rest))throw Error('听到了多个当前余量，请核对后保留一个数值。');
 return spokenMoney(m[1]);
}
export function parseVoiceCommand(card,raw,today){
 if(typeof raw!=='string'||raw.length>160)throw Error('请用一句简短的话记录，最多 160 字。');
 const text=raw.trim().replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/\s+/g,'');
 if(!text)throw Error('没有听到内容，请重新说。');
 if(/不是|不要|别记|取消|不对|吗|多少|几次|查询|查看|怎么|是否|能不能|负|[-－]\d/.test(text))throw Error('这句话还不能确定操作，请直接说实际使用或当前余量。');
 if(/想消费|打算|准备|计划|如果|假如|大概|差不多|可能|预计|应该|左右|充值|退款|转账/.test(text))throw Error('请只记录已发生的使用或明确的当前余量，充值退款暂用手动核对。');
 const date=dateFromText(text,today),correction=text.match(/余额(?:还剩|剩余|为|是|还有)?|还剩|剩余|校正为|设置为|更新为|改成/),expense=text.match(/消费|花了|花费|扣了|支付了|支出了/);
 if(correction&&expense)throw Error('同时听到了消费和余额，请分两次说，先确认一项操作。');
 if(correction){
  if(card.type!=='cash')throw Error('当前版本不维护剩余次数，请在编辑权益里更新截止日期。');
  if(date!==today)throw Error('余量校正仅记录当前值；历史使用请说具体消费或次数。');
  let quantity;
  if(card.type==='cash')quantity=amountAfter(text,correction);
  else {const tail=text.slice(correction.index+correction[0].length).replace(/^[了有是为到]+/,'');const m=tail.match(new RegExp(`^(${NUM})次[。！!，,]?$`));if(!m)throw Error('请明确说“现在还剩五次”。');quantity=spokenNumber(m[1]);if(!Number.isInteger(quantity)||quantity<0||quantity>9999)throw Error('剩余次数应为 0 到 9999 的整数。');}
  return {intent:'adjust',date,quantity,transcript:raw.trim()};
 }
 if(card.type==='cash'&&expense){if(new RegExp(`${NUM}[次回]`).test(text)&&/骑了|骑行|健身|训练/.test(text))throw Error('这句话包含不同类型的使用，请分开记录。');return {intent:'consume',date,...expenseAmounts(text),transcript:raw.trim()};}
 if(expense&&card.type!=='cash')throw Error('这项权益不是储值卡，请说使用次数或只打卡。');
 if(/打卡|骑了|骑车|骑行|健身|练了|训练|看了|使用了|用了/.test(text)){
  return {intent:'checkin',date,transcript:raw.trim()};
 }
 throw Error(card.type==='cash'?'请说明是“消费了多少”还是“现在还剩多少”。':'请说“使用了一次”“还剩五次”或“只打卡”。');
}
export function createVoiceUpdate(card,command,today){
 if(command.intent!=='adjust')return createCheckin(card,{date:command.date,note:command.transcript,debit:card.type==='cash'&&command.intent==='consume',units:command.units,amount:command.amount===undefined?'':(command.amount/100).toFixed(2)},today);
 if(card.archived||card.type!=='cash'||command.date!==today)throw Error('当前卡片不能进行这项校正。');
 const next={...card,quantity:command.quantity,verified:'',revision:card.revision+1};if(!validateCard(next))throw Error('校正数值无效。');
 return {card:next,event:{kind:'adjust',date:command.date,note:command.transcript,debit:card.quantity===null?0:card.quantity-command.quantity,previousQuantity:card.quantity,afterQuantity:command.quantity,previousVerified:card.verified,revisionAfter:next.revision,undone:false}};
}
