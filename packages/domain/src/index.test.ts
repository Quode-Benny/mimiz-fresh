import { describe, it, expect } from 'vitest';
import { basketTotal, daypartAt, formatMoney, priceSelection, restoreBasket } from './index';
import { demoMenu } from '@mimiz/shared/demo-menu';
const jollof = demoMenu.find(item => item.id === 'jollof')!;
const selection = { itemId: 'jollof', optionIds: ['chicken'], quantity: 1, note: '' };
describe('basket pricing', () => {
  it('keeps money exact in integer pesewas', () => expect(basketTotal([{pricePesewas:1999,quantity:3},{pricePesewas:101,quantity:1}])).toBe(6098));
  it('rejects fractional money and negative quantities', () => { expect(() => basketTotal([{pricePesewas:1.5,quantity:1}])).toThrow(); expect(() => basketTotal([{pricePesewas:100,quantity:-1}])).toThrow(); });
  it('handles empty baskets', () => expect(basketTotal([])).toBe(0));
  it('includes options before multiplying quantity', () => { const line = priceSelection(jollof, { ...selection, optionIds: ['fish', 'egg'], quantity: 2 }); expect(basketTotal([{pricePesewas:line.unitPricePesewas,quantity:line.quantity}])).toBe(16000); });
  it('requires protein and caps extras', () => { expect(() => priceSelection(jollof, {...selection,optionIds:[]})).toThrow(); expect(() => priceSelection(jollof, {...selection,optionIds:['chicken','egg','plantain','shito']})).toThrow(); });
  it('rejects duplicate and foreign options', () => { expect(() => priceSelection(jollof, {...selection,optionIds:['chicken','chicken']})).toThrow(); expect(() => priceSelection(jollof, {...selection,optionIds:['chicken','unknown']})).toThrow(); });
  it('separates different notes and meal choices', () => { expect(priceSelection(jollof,selection).key).not.toBe(priceSelection(jollof,{...selection,note:'Less pepper'}).key); expect(priceSelection(jollof,selection).key).not.toBe(priceSelection(jollof,{...selection,optionIds:['fish']}).key); });
  it('recalculates saved prices from the menu', () => { const restored=restoreBasket([{...selection,pricePesewas:1}],demoMenu); expect(priceSelection(jollof,restored[0]!).unitPricePesewas).toBe(6500); });
  it('rejects corrupt storage and unavailable dishes', () => { expect(() => restoreBasket({itemId:'jollof'},demoMenu)).toThrow(); expect(() => restoreBasket([{...selection,quantity:Infinity}],demoMenu)).toThrow(); expect(() => restoreBasket([{itemId:'asana',optionIds:[],quantity:1,note:''}],demoMenu)).toThrow(); });
  it('formats cedis with two decimals', () => expect(formatMoney(6500)).toBe('\u20b565.00'));
});
describe('Ghanaian dayparts', () => {
  it.each([['04:59','late_night'],['05:00','breakfast'],['10:59','breakfast'],['11:00','lunch'],['15:00','afternoon'],['18:00','dinner'],['22:00','late_night']])('classifies %s as %s', (time, expected) => expect(daypartAt(new Date('2026-10-21T'+time+':00Z'))).toBe(expected));
});
