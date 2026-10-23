type MenuItem={id:string;name:string};
export type MealSuggestion={itemId:string;quantity:number;name:string};
const normalize=(s:string)=>s.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const ignored=new Set(['and','with','the','from','of','fried','grilled','chilled','ripe']);
function match(text:string,menu:MenuItem[]){
 const words=new Set(normalize(text).split(' '));
 const scored=menu.map(item=>({item,score:normalize(item.name).split(' ').filter(w=>!ignored.has(w)&&words.has(w)).length})).filter(x=>x.score>0);
 if(!scored.length)return [];
 const best=Math.max(...scored.map(x=>x.score));
 return scored.filter(x=>x.score===best).slice(0,4).map(x=>x.item);
}
function quantity(text:string):number|undefined{
 const normalized=normalize(text),words:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
 const digit=normalized.match(/\b(\d+)\b/);if(digit)return Number(digit[1]);
 for(const [word,value] of Object.entries(words))if(new RegExp('\\b'+word+'\\b').test(normalized))return value;
}
export function mealRequest(question:string,previous:string[],menu:MenuItem[]):{suggestions:MealSuggestion[];error?:string}|null{
 if(/\b(how|what|which|where|when|why|price|cost|vegetarian|spicy|available)\b/i.test(question)&&! /\b(i want|add|order .* for me)\b/i.test(question))return null;
 const requested=/\b(order|add|want|buy|take|i(?: would| d)? like|can i have|can you get|make that)\b/i.test(normalize(question));
 const followup=/\b(that|those|it|instead|please)\b/i.test(question)&&quantity(question)!==undefined;
 if(!requested&&!followup)return null;
 let items=match(question,menu);
 if(!items.length&&/\b(that|those|it)\b/i.test(question)){
  for(const text of previous.slice(-4).reverse()){items=match(text,menu);if(items.length)break;}
 }
 const count=quantity(question)??1;
 if(count<1||count>20)return {suggestions:[],error:'Choose a quantity from 1 to 20 for a meal.'};
 return {suggestions:items.map(item=>({itemId:item.id,quantity:count,name:item.name}))};
}
