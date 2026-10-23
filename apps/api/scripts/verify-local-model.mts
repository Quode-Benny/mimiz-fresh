import {LocalSupportModel} from '@mimiz/providers';
const model=new LocalSupportModel('http://127.0.0.1:11438','qwen2.5:0.5b');
const answers=[{id:'menu',text:'From the current kitchen menu: Ghana jollof, waakye, banku and chilled sobolo.'},{id:'spicy',text:'Dishes marked spicy include jollof and kelewele. Check the current menu choices.'},{id:'pickup',text:'Choose Pickup above the menu and follow the tracker until ready to collect.'},{id:'greeting',text:'Akwaaba! I can help with menu questions, delivery, pickup and opening hours.'},{id:'delivery',text:'Delivery needs a map pin and landmark. Checkout checks coverage and calculates the fee.'},{id:'vegetarian',text:'Our menu currently includes vegetarian red red and kelewele. Tags are not an allergy guarantee.'},{id:'hours',text:'The kitchen opens 08:00 to 22:00 Ghana time today.'}];
for(const [question,expected] of [['What food is on the menu?','menu'],['How does delivery work?','delivery'],['What vegetarian food do you have?','vegetarian'],['When does the kitchen open?','hours']]){
 const start=Date.now(),decision=await model.choose(question!,answers);
 console.log(JSON.stringify({scenario:expected,answerId:decision.answerId,handover:decision.handover,durationMs:Date.now()-start}));
 if(decision.handover||decision.answerId!==expected)throw Error('Local model did not select the grounded answer for '+expected);
}
if(!(await model.choose('I want a human to refund my order',answers)).handover)throw Error('Human request was not escalated.');
console.log('Actual local-model routing and sensitive-request handover passed.');
