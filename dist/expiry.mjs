import {validDate} from './domain.mjs?v=12';
export function expiryInfo(card,today){
 if(!today||!validDate(today))throw Error('日期无效');
 if(card.noExpiry)return {days:null,expired:false,date:'长期有效',label:'长期有效',tone:''};
 if(!card.end)return {days:null,expired:false,date:'待补充',label:'截止日期待补充',tone:''};
 const days=Math.round((Date.parse(card.end+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 return {days,expired:days<0,date:card.end,label:days<0?`已过期 ${-days} 天`:days===0?'今天到期':`还有 ${days} 天到期`,tone:days<0?' expired':days<=7?' warning':''};
}
export function sortByExpiry(cards,today){
 return [...cards].sort((a,b)=>{
  const x=expiryInfo(a,today),y=expiryInfo(b,today);
  const rank=s=>s.days===null?2:s.expired?1:0;
  if(rank(x)!==rank(y))return rank(x)-rank(y);
  if(x.days!==null&&y.days!==null&&x.days!==y.days)return x.expired?y.days-x.days:x.days-y.days;
  return 0;
 });
}
export function overviewFor(cards,today){
 const current=sortByExpiry(cards.filter(c=>!c.archived&&!expiryInfo(c,today).expired),today);
 return {currentCount:current.length,expiringCount:current.filter(c=>{const d=expiryInfo(c,today).days;return d!==null&&d<=7;}).length,featured:current[0]??null};
}
export function expiryStage(card,today){
 const {days}=expiryInfo(card,today);
 if(days===null)return card.noExpiry?{key:'long',label:'长期有效'}:{key:'unknown',label:'日期待补充'};
 if(days<0)return {key:'expired',label:'已过期'};
 if(days===0)return {key:'today',label:'今天到期'};
 if(days<=3)return {key:'urgent',label:'3天内到期'};
 if(days<=7)return {key:'soon',label:'7天内到期'};
 return {key:'normal',label:'有效期内'};
}
