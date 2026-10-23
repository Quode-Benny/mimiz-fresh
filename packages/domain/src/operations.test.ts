import {describe,it,expect} from 'vitest';
import {calculateOrderTotals,isOpenAt,scheduleSlots,menuSearchScore} from './operations';
import {demoMenu} from '@mimiz/shared/demo-menu';
describe('order fee and tax arithmetic',()=>{
 const base={subtotal:10000,deliveryFee:1000,discount:0,feeKind:'fixed' as const,feeValue:500,taxBps:1000,taxDelivery:false};
 it('calculates configured exclusive tax with integer pesewas',()=>expect(calculateOrderTotals(base)).toEqual({serviceFee:500,tax:1050,total:12550}));
 it('keeps free-delivery discounts separate from food-based percentage fees',()=>expect(calculateOrderTotals({...base,discount:1000,discountOnDelivery:true,feeKind:'percent',feeValue:500})).toEqual({serviceFee:500,tax:1050,total:11550}));
 it('uses discounted food and an explicit delivery-tax flag',()=>{expect(calculateOrderTotals({...base,discount:1000})).toEqual({serviceFee:500,tax:950,total:11450});expect(calculateOrderTotals({...base,taxDelivery:true}).tax).toBe(1150);});
 it('rounds half a pesewa up and rejects unsafe or invalid amounts',()=>{expect(calculateOrderTotals({...base,subtotal:125,deliveryFee:0,feeValue:0}).tax).toBe(13);expect(()=>calculateOrderTotals({...base,discount:10001})).toThrow();expect(()=>calculateOrderTotals({...base,subtotal:Number.MAX_SAFE_INTEGER})).toThrow();});
});
describe('Ghana kitchen hours and scheduling',()=>{
 const hours=Array.from({length:7},()=>({open:'08:00',close:'22:00',closed:false}));
 it('honours open/close boundaries and calendar closures',()=>{expect(isOpenAt({hours},new Date('2026-10-21T08:00:00Z'))).toBe(true);expect(isOpenAt({hours},new Date('2026-10-21T22:00:00Z'))).toBe(false);expect(isOpenAt({hours,closures:['2026-10-21']},new Date('2026-10-21T12:00:00Z'))).toBe(false);});
 it('handles overnight windows without carrying a closed holiday into the next day',()=>{const overnight=hours.map(day=>({...day,open:'22:00',close:'02:00'}));expect(isOpenAt({hours:overnight},new Date('2026-10-22T01:00:00Z'))).toBe(true);expect(isOpenAt({hours:overnight,closures:['2026-10-21']},new Date('2026-10-22T01:00:00Z'))).toBe(false);});
 it('offers only open quarter-hour slots at least fifteen minutes ahead',()=>{const now=new Date('2026-10-21T21:51:00Z'),slots=scheduleSlots({hours},now);expect(slots[0]).toBe('2026-10-22T08:00:00.000Z');expect(slots.every(value=>new Date(value).getUTCMinutes()%15===0&&Date.parse(value)>=now.getTime()+900000&&Date.parse(value)<=now.getTime()+3*86400000)).toBe(true);});
});
describe('menu search ranking',()=>{
 const jollof=demoMenu.find(item=>item.id==='jollof')!,waakye=demoMenu.find(item=>item.id==='waakye')!;
 it('handles missing letters and adjacent transpositions',()=>{expect(menuSearchScore(jollof,'jolof')).not.toBeNull();expect(menuSearchScore(waakye,'waakey')).not.toBeNull();});
 it('ranks exact dish names above recipe and tag matches',()=>{expect(menuSearchScore(jollof,'jollof')).toBeLessThan(menuSearchScore({...jollof,name:'Rice',tags:['jollof']},'jollof')!);});
 it('does not turn unrelated multi-word queries into matches',()=>expect(menuSearchScore(jollof,'not-on-the-menu')).toBeNull());
});
