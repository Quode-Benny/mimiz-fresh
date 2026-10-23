import {defaultDayparts,withinWindow,type DaypartDefinition} from './operations';
export * from './operations';
import type { BasketSelection, Daypart, MenuItem, PricedBasketLine } from '@mimiz/shared';
export function basketTotal(lines: readonly { pricePesewas: number; quantity: number }[]): number {
  let total = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.pricePesewas) || line.pricePesewas < 0 || !Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new RangeError('Invalid basket line');
    total += line.pricePesewas * line.quantity;
    if (!Number.isSafeInteger(total)) throw new RangeError('Basket total too large');
  }
  return total;
}
export function formatMoney(pesewas: number): string {
  return `\u20b5${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function daypartAt(date:Date,definitions:DaypartDefinition[]=defaultDayparts):Daypart{
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Accra',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
 return definitions.find(definition=>withinWindow(time,definition.start,definition.end))?.id||'late_night';
}
export function priceSelection(item: MenuItem, selection: BasketSelection): PricedBasketLine {
  if (!item.available) throw new Error('This dish is currently unavailable.');
  if (selection.itemId !== item.id || !Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 20) throw new Error('Choose a quantity between 1 and 20.');
  if (selection.note.length > 300) throw new Error('Keep kitchen notes under 300 characters.');
  if (new Set(selection.optionIds).size !== selection.optionIds.length) throw new Error('Choose each option only once.');
  const options = item.optionGroups.flatMap(group => group.options).filter(option => selection.optionIds.includes(option.id));
  if (options.length !== selection.optionIds.length) throw new Error('An option is no longer on this menu.');
  for (const group of item.optionGroups) {
    const count = group.options.filter(option => selection.optionIds.includes(option.id)).length;
    if (count < group.minimum || count > group.maximum) throw new Error(`Check your choices for ${group.name.toLowerCase()}.`);
  }
  const unitPricePesewas = item.pricePesewas + options.reduce((total, option) => total + option.priceDeltaPesewas, 0);
  if (!Number.isSafeInteger(unitPricePesewas) || unitPricePesewas < 0) throw new Error('This dish has an invalid price.');
  const note = selection.note.trim();
  return { ...selection, note, key: JSON.stringify([item.id, [...selection.optionIds].sort(), note]), item, options, unitPricePesewas };
}
export function restoreBasket(value: unknown, menu: readonly MenuItem[]): BasketSelection[] {
  if (!Array.isArray(value)) throw new Error('Saved basket has an invalid format.');
  if (value.length > 100) throw new Error('Saved basket is too large.');
  const restored: BasketSelection[] = [];
  const keys = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || typeof entry.itemId !== 'string' || !Array.isArray(entry.optionIds) || !entry.optionIds.every((id: unknown) => typeof id === 'string') || typeof entry.quantity !== 'number' || typeof entry.note !== 'string') throw new Error('Saved basket contains invalid items.');
    const item = menu.find(dish => dish.id === entry.itemId);
    if (!item) throw new Error('A saved dish is no longer on this menu.');
    const line = priceSelection(item, entry);
    if (keys.has(line.key)) throw new Error('Saved basket contains duplicate lines.');
    keys.add(line.key);
    restored.push({ itemId: line.itemId, optionIds: line.optionIds, quantity: line.quantity, note: line.note });
  }
  return restored;
}
