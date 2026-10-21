"use client";
import {useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {Button} from '@mimiz/ui';
import type {MenuItem} from '@mimiz/shared';
import {api} from '../../lib/api';
import {Failure} from '../platform-frame';
export function CatalogueEditor({item,branchId,refresh}:{item:MenuItem;branchId:string;refresh:()=>unknown}){
 const [open,setOpen]=useState(false),[error,setError]=useState<any>(null),[busy,setBusy]=useState(false);
 return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><Button>Edit dish</Button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="overlay"/><Dialog.Content className="kitchen-dialog"><div className="sheet-head"><Dialog.Title>Edit {item.name}</Dialog.Title><Dialog.Close className="icon-button" aria-label="Close dish editor"><X/></Dialog.Close></div><Dialog.Description>Company catalogue changes take effect across branches.</Dialog.Description><form className="panel" style={{border:0,padding:0,margin:0}} onSubmit={async event=>{event.preventDefault();setBusy(true);const form=new FormData(event.currentTarget);try{await api('/staff/catalogue/'+item.id,{method:'PATCH',body:JSON.stringify({branchId,name:form.get('name'),description:form.get('description'),category:form.get('category'),pricePesewas:Math.round(Number(form.get('price'))*100)})});await refresh();setOpen(false);}catch(error){setError(error);}finally{setBusy(false);}}}><label>Name<input name="name" defaultValue={item.name} required minLength={2}/></label><label>Description<textarea name="description" defaultValue={item.description} required minLength={5}/></label><label>Category<input name="category" defaultValue={item.category} required minLength={2}/></label><label>Price (GHS)<input name="price" type="number" min={0} step=".01" defaultValue={item.pricePesewas/100} required/></label>{error&&<Failure error={error}/>}<Button className="primary" disabled={busy} style={{marginTop:20}}>Save dish</Button></form></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
