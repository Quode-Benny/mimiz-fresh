import {isOpenAt} from '@mimiz/domain';
import type { OrderStatus } from '@mimiz/shared';
import {roleActions, transitions } from '@mimiz/shared';
import { fail, type Actor } from './security';
export function transitionAllowed(from:OrderStatus,to:OrderStatus,fulfillment:string,actor:Actor){
 if(!transitions[from].includes(to))fail(409,'That order status change is not allowed.','INVALID_TRANSITION');
 if(fulfillment==='pickup'&&to==='out_for_delivery')fail(409,'Pickup orders do not go out for delivery.');
 if(fulfillment==='delivery'&&from==='ready'&&to==='completed')fail(409,'Mark the delivery out for delivery first.');
 if(roleActions[actor.role]&&!roleActions[actor.role]!.includes(to))fail(403,'Your role cannot perform that action.');
 if(actor.role==='customer'&&!['placed','pending_payment'].includes(from))fail(409,'The kitchen has started your order. Contact support to cancel.');
}
export function checkHours(branch:any,scheduledFor?:string){
 const now=new Date();let at=now;
 if(scheduledFor){at=new Date(scheduledFor);const delay=at.getTime()-now.getTime();if(!Number.isFinite(delay)||delay<15*60000||delay>3*86400000||at.getUTCMinutes()%15!==0||at.getUTCSeconds()!==0||at.getUTCMilliseconds()!==0)fail(400,'Choose a 15-minute slot, at least 15 minutes ahead and within 3 days.');}
 if(!isOpenAt(branch,at))fail(409,'This kitchen is closed at that time. Choose an opening slot.');
 return at;
}
