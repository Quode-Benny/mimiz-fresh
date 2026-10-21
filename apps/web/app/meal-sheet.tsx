"use client";
import { useState } from 'react';
import Image from 'next/image';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Minus, Plus, X } from 'lucide-react';
import { Button } from '@mimiz/ui';
import { formatMoney, priceSelection } from '@mimiz/domain';
import type { BasketSelection, MenuItem } from '@mimiz/shared';
export function MealSheet({ item, add, close, restoreFocus }: { item: MenuItem; add: (selection: BasketSelection) => Promise<unknown>; close: () => void; restoreFocus: () => void }) {
  const [optionIds, setOptionIds] = useState(item.optionGroups.flatMap(group => group.options.filter(option => option.isDefault).map(option => option.id)));
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy,setBusy]=useState(false);
  const selection = { itemId: item.id, optionIds, quantity, note };
  let total = item.pricePesewas * quantity;
  let valid = true;
  try { total = priceSelection(item, selection).unitPricePesewas * quantity; } catch { valid = false; }
  function choose(groupId: string, optionId: string) {
    const group = item.optionGroups.find(group => group.id === groupId)!;
    setOptionIds(current => {
      if (group.maximum === 1) return [...current.filter(id => !group.options.some(option => option.id === id)), optionId];
      return current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId];
    });
    setError('');
  }
  return <Dialog.Content className="sheet meal-sheet" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
    <div className="meal-photo"><Image src={item.image} alt={item.name} fill sizes="(max-width: 600px) 100vw, 480px" /><Dialog.Close className="icon-button close-on-photo" aria-label="Close meal details"><X size={20} /></Dialog.Close></div>
    <div className="meal-content"><p className="eyebrow">{item.category}</p><div className="meal-title"><Dialog.Title>{item.name}</Dialog.Title><strong>{formatMoney(item.pricePesewas)}</strong></div><Dialog.Description>{item.description}</Dialog.Description>
      <p className="photo-disclaimer">Illustrative photo. Your meal may look different.</p>
      {item.optionGroups.map(group => <fieldset className="option-group" key={group.id}><legend>{group.name}<span>{group.minimum > 0 ? 'Required' : 'Optional'}</span></legend><p>{group.maximum === 1 ? 'Choose one' : `Choose up to ${group.maximum}`}</p>{group.options.map(option => {
        const selected = optionIds.includes(option.id);
        const full = group.options.filter(option => optionIds.includes(option.id)).length >= group.maximum;
        return <label className={`option-choice ${selected ? 'chosen' : ''}`} key={option.id}><input type={group.maximum === 1 ? 'radio' : 'checkbox'} name={group.id} checked={selected} disabled={group.maximum > 1 && full && !selected} onChange={() => choose(group.id, option.id)} /><span>{option.name}</span><b>{option.priceDeltaPesewas ? `+ ${formatMoney(option.priceDeltaPesewas)}` : 'Included'}</b></label>;
      })}</fieldset>)}
      {item.allergens?.length ? <div className="allergen-note"><b>Recipe notes</b><p>Contains: {item.allergens.join(', ')}. Sample recipe only. For an allergy, confirm ingredients with the restaurant before ordering.</p></div> : null}
      <label className="note-label" htmlFor="kitchen-note">A note for the kitchen <span>Optional</span></label><textarea id="kitchen-note" value={note} onChange={event => setNote(event.target.value)} maxLength={300} rows={3} placeholder="A preference or small request..." /><span className="note-count">{note.length}/300</span>
    </div>
    <div className="meal-actions"><div className="stepper"><button aria-label="Decrease quantity" disabled={quantity === 1} onClick={() => setQuantity(value => value - 1)}><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button aria-label="Increase quantity" disabled={quantity === 20} onClick={() => setQuantity(value => value + 1)}><Plus size={16} /></button></div><Button className="primary" disabled={!valid || busy} onClick={async () => { setBusy(true);try { await add(selection); close(); } catch (error) { setError(error instanceof Error ? error.message : 'Check your meal choices.'); } finally{setBusy(false);} }}>{busy ? 'Adding...' : 'Add to bag'} <span>{formatMoney(total)}</span><ArrowRight size={17} /></Button>{error && <p role="alert">{error}</p>}</div>
  </Dialog.Content>;
}
