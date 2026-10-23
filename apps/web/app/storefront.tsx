"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {useQuery} from '@tanstack/react-query';
import {api,type Branch,type CompanyConfiguration} from '../lib/api';
import {useSession} from './providers';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChefHat, ChevronDown, Clock3, Flame, Leaf, MapPin, Minus, Plus, Search, ShoppingBag, Sparkles, Truck, UtensilsCrossed, WifiOff, X } from 'lucide-react';
import { Button } from '@mimiz/ui';
import { daypartAt, formatMoney,menuSearchScore } from '@mimiz/domain';
import { demoMenu, menuCategories } from '@mimiz/shared/demo-menu';
import type { Daypart, MenuItem } from '@mimiz/shared';
import { copy } from '../messages/en';
import { useBasket } from './use-basket';
import {RecommendationShelf,type RecommendationGroup} from './recommendations';
import {BranchChooser} from './branch-chooser';
import {CustomerResume} from './support-launcher';
import {ThemeControl} from './theme';
import {CustomerHighlights} from './customer-highlights';
import { MealSheet } from './meal-sheet';
const daypartLabels: Record<Daypart, string> = { breakfast: 'Breakfast', lunch: 'Lunch', afternoon: 'Afternoon', dinner: 'Dinner', late_night: 'Late night' };
function Brand({logo}:{logo?:string}) { return <a className="wordmark" href="#top" aria-label="Mimiz home">{logo?<Image src={logo} alt="Restaurant logo" width={110} height={46} style={{objectFit:'contain'}}/>:<>mimiz<Sparkles aria-hidden="true" /></>}</a>; }
function FoodImage({ item, hero = false }: { item: MenuItem; hero?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className="image-fallback"><UtensilsCrossed size={30} /><span>{item.name}</span></div> : <Image src={item.image} alt={item.name} fill sizes={hero ? '(max-width: 700px) 100vw, 550px' : '(max-width: 600px) 50vw, (max-width: 900px) 50vw, 360px'} priority={hero} onError={() => setFailed(true)} />;
}
export function Storefront() {
  const [category, setCategory] = useState('Everything');
  const [recommendationSource,setRecommendationSource]=useState('catalogue');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('suggested');
  const [sort,setSort]=useState('recommended');
  const [diet, setDiet] = useState('all');

  const [daypart, setDaypart] = useState<Daypart | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [online, setOnline] = useState(true);
  const [added, setAdded] = useState('');
  const basket = useBasket();
  const mode=basket.data?.fulfillment==='pickup'?'Pickup':'Delivery';
  const session=useSession();
  const branches=useQuery<Branch[]>({queryKey:['branches'],queryFn:()=>api('/branches')});
  const company=useQuery<CompanyConfiguration>({queryKey:['company-settings'],queryFn:()=>api('/settings'),staleTime:60000,refetchInterval:60000});
  const branchId=basket.data?.branch_id||branches.data?.[0]?.id;
  const menuQuery=useQuery<{items:MenuItem[]}>({queryKey:['menu',branchId],queryFn:()=>api('/branches/'+branchId+'/menu'),enabled:!!branchId,refetchInterval:15000});
  const categories=useQuery<{id:string;name:string;parent_id:string|null}[]>({queryKey:['categories',branchId],queryFn:()=>api('/branches/'+branchId+'/categories'),enabled:!!branchId});
  const dishes=menuQuery.data?.items||[];
  const recommendations=useQuery<{groups:RecommendationGroup[];popularity:Record<string,number>}>({queryKey:['recommendations',branchId,daypart,session.data?.id,basket.data?.version],queryFn:()=>api('/branches/'+branchId+'/recommendations?daypart='+daypart),enabled:!!branchId&&!!daypart,staleTime:300000});
  const recommendationGroups=company.data?.settings.flags.recommendations===false?[]:recommendations.data?.groups||[];
  const labels={...daypartLabels,...Object.fromEntries((company.data?.settings.dayparts||[]).map(part=>[part.id,part.label]))};
  const categoryNames=categories.data?.length?['Everything',...categories.data.filter(category=>dishes.some(item=>item.category===category.name)||categories.data!.some(child=>child.parent_id===category.id&&dishes.some(item=>item.category===child.name))).map(category=>category.name)]:Array.from(new Set([...menuCategories,...dishes.map(item=>item.category)]));

  const kitchenName=branches.data?.find(branch=>branch.id===branchId)?.name||'Accra kitchen';
  const heroDish=dishes.find(item=>item.id==='jollof')||demoMenu[0]!;
  const returnFocus = useRef<HTMLElement | null>(null);
  function rememberFocus() { returnFocus.current = document.activeElement as HTMLElement | null; }
  function restoreFocus() { requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true })); }
  function openMeal(item: MenuItem,source='catalogue') { setRecommendationSource(source);rememberFocus(); setSelected(item); }
  function openBag() { rememberFocus(); setBagOpen(true); }
  function openKitchen() { rememberFocus(); setKitchenOpen(true); }
  useEffect(() => {
    const tick = () => setDaypart(daypartAt(new Date(),company.data?.settings.dayparts));
    const updateOnline = () => setOnline(navigator.onLine);
    tick(); updateOnline();
    const timer = window.setInterval(tick, 60000);
    window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);

    return () => { window.clearInterval(timer); window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
  }, [company.data?.version]);

  useEffect(() => { if (!added) return; const timer = window.setTimeout(() => setAdded(''), 3500); return () => window.clearTimeout(timer); }, [added]);
  async function changeMode(value: string) { try{await basket.fulfillment(value==='Pickup'?'pickup':'delivery');}catch{} }
  const filtered = useMemo(() => {
    const parent=categories.data?.find(value=>value.name===category);
    const items=dishes.filter(item=>(category==='Everything'||item.category===category||categories.data?.some(child=>child.name===item.category&&child.parent_id===parent?.id))&&(diet==='all'||item.vegetarian)&&menuSearchScore(item,search)!==null);
    if(search.trim())items.sort((a,b)=>menuSearchScore(a,search)!-menuSearchScore(b,search)!);
    else if(sort==='price_low')items.sort((a,b)=>a.pricePesewas-b.pricePesewas);
    else if(sort==='price_high')items.sort((a,b)=>b.pricePesewas-a.pricePesewas);
    else if(sort==='popular')items.sort((a,b)=>(recommendations.data?.popularity[b.id]||0)-(recommendations.data?.popularity[a.id]||0));
    else if(view==='suggested'&&daypart)items.sort((a,b)=>Number(b.available)-Number(a.available)||Number(b.dayparts.includes(daypart))-Number(a.dayparts.includes(daypart)));
    return items;
  }, [category,search,diet,view,daypart,dishes,sort,categories.data,recommendations.data]);
  const reset = () => { setSearch(''); setCategory('Everything'); setDiet('all'); };
  return <div id="top"><a className="skip-link" href="#menu">Skip to menu</a>
    <div className="preview-bar"><span><span className="preview-dot" />{copy.preview}</span><p>{copy.previewDetail}</p></div>
    {!online && <div className="offline-banner" role="status"><WifiOff size={17} />You are offline. You can browse this loaded sample menu; orders are unavailable.</div>}
    <header className="header"><div className="header-inner"><Brand logo={company.data?.logo} /><nav aria-label="Main navigation"><a href="#menu" className="active">The menu</a><a href="#story">Our kitchen <ArrowUpRight size={14} /></a><Link href="/orders">My orders</Link><Link href="/account">Account</Link></nav><div className="header-actions"><ThemeControl/><button className="branch-chip" disabled={!basket.ready||basket.busy} onClick={openKitchen}><MapPin size={17} /><span>{kitchenName}<small>{mode} <ChevronDown size={12} /></small></span></button><Button className="bag-button" onClick={openBag} aria-label={`Open bag, ${basket.count} items`}><ShoppingBag size={18} /><span className="bag-label">Your bag</span><b>{basket.count}</b></Button></div></div></header>
    <main><section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className="orange-dot" />{copy.heroEyebrow}</p><h1 id="hero-title">{copy.heroTitle[0]}<br /><em>{copy.heroTitle[1]}</em></h1><p className="intro">{copy.heroDescription}</p><a className="button primary" href="#menu">{copy.heroAction}<ArrowDown size={18} /></a><div className="hero-footnote"><span><ChefHat size={19} /></span><p>From waakye mornings to jollof evenings.<small>There is always something that feels like home.</small></p></div></div><div className="hero-art"><div className="hero-photo"><FoodImage item={heroDish} hero /></div><div className="hero-stamp"><UtensilsCrossed size={24} /><span>GOOD FOOD.<br />GHANAIAN SOUL.</span></div><button className="hero-dish" onClick={() => openMeal(heroDish)}><span><small>START WITH A CLASSIC</small><b>Smoky Ghana jollof</b><span>From {formatMoney(heroDish.pricePesewas)}</span></span><span className="round-arrow"><ArrowUpRight size={22} /></span></button></div></section>
    <section className="order-strip" aria-label="Your ordering preferences"><button className="kitchen-selector" disabled={!basket.ready||basket.busy} onClick={openKitchen}><span className="location-icon"><MapPin size={21} /></span><span><small>YOUR KITCHEN</small><b>{kitchenName}<ChevronDown size={15} /></b><span>{branches.data?.find(branch=>branch.id===branchId)?.address||copy.kitchenNote}</span></span></button><div className="fulfilment" aria-label="Fulfilment type">{['Delivery', 'Pickup'].map(value => <button key={value} disabled={!basket.ready||basket.busy} aria-pressed={mode === value} className={mode === value ? 'selected' : ''} onClick={() => changeMode(value)}>{value === 'Delivery' ? <Truck size={16} /> : <ShoppingBag size={16} />}{value}</button>)}</div><div className="eta"><Clock3 size={20} /><span>{mode === 'Delivery' ? 'A good meal, on its way' : 'Freshly made, ready to collect'}<small>{mode === 'Delivery' ? 'Sample estimate: 35-50 min' : 'Sample estimate: 20-30 min'}</small></span></div></section>
    <CustomerResume/>
    <CustomerHighlights items={dishes} onChoose={openMeal}/>
    <section className="menu" id="menu" aria-labelledby="menu-title"><div className="menu-heading"><div><p className="eyebrow">{copy.menuEyebrow}</p><h2 id="menu-title">{copy.menuTitle}</h2><p>{copy.menuDescription}</p></div><label className="search"><Search size={20} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search} maxLength={80} aria-label="Search the menu" />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={18} /></button>}</label></div>
    <div className="menu-controls"><div className="view-switch" aria-label="Menu view"><button className={view === 'suggested' ? 'selected' : ''} aria-pressed={view === 'suggested'} onClick={() => setView('suggested')}><Sparkles size={16} />Suggested now</button><button className={view === 'all' ? 'selected' : ''} aria-pressed={view === 'all'} onClick={() => setView('all')}>All items</button></div><p className="daypart"><Clock3 size={14} />{daypart ? `${labels[daypart]} in Accra` : 'Ghana time'}<span>Everything is still on the menu.</span></p></div>
    {view==='suggested'&&!search.trim()&&category==='Everything'&&diet==='all'&&branchId&&recommendationGroups.filter(group=>group.source!=='together').map(group=><RecommendationShelf key={branchId+group.source} group={group} branchId={branchId} onChoose={openMeal}/>)}
    <div className="category-wrap"><div className="categories" aria-label="Food categories">{categoryNames.map(value => <button key={value} className={category === value ? 'selected' : ''} aria-pressed={category === value} onClick={() => setCategory(value)}>{value === 'Everything' && <UtensilsCrossed size={16} />}{value}</button>)}</div></div>
    <div className="menu-meta"><span role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'dish' : 'dishes'}<span className="meta-divider" />{search ? `Results for "${search}"` : category === 'Everything' ? 'A proper Ghanaian spread' : category}</span><button className={`diet-filter ${diet === 'vegetarian' ? 'selected' : ''}`} aria-pressed={diet === 'vegetarian'} onClick={() => setDiet(value => value === 'all' ? 'vegetarian' : 'all')}><Leaf size={15} />Vegetarian{diet === 'vegetarian' && <Check size={14} />}</button></div>
    <div className="menu-sort"><label>Sort by<select value={sort} onChange={event=>setSort(event.target.value)} aria-label="Sort the menu"><option value="recommended">Recommended</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option><option value="popular">Most popular</option></select></label></div>
    {menuQuery.isPending&&<div className="menu-loading" role="status">Loading the kitchen menu...</div>}{menuQuery.error&&<div className="inline-error" role="alert">The menu could not load. <button onClick={()=>menuQuery.refetch()}>Try again</button></div>}<div className="menu-grid">{filtered.map(item => <article className={`dish ${!item.available ? 'unavailable' : ''}`} key={item.id} data-testid={`dish-${item.id}`}><div className="dish-photo"><button className="dish-photo-link" aria-label={`View ${item.name}`} onClick={() => openMeal(item)} disabled={!item.available}><FoodImage item={item} /></button>{item.badge && <span className="dish-badge">{item.badge === 'KITCHEN PICK' && <Flame size={12} />}{item.badge}</span>}<button className="add-dish" disabled={!item.available} aria-label={`Add ${item.name} to bag`} onClick={() => openMeal(item)}><Plus size={22} /></button>{!item.available && <span className="sold-out">Unavailable</span>}</div><div className="dish-info"><div className="dish-category">{item.category}{item.vegetarian && <span><Leaf size={12} />Vegetarian</span>}</div><h3><button onClick={() => openMeal(item)} disabled={!item.available}>{item.name}</button></h3><p>{item.description}</p><div className="dish-footer"><strong>{formatMoney(item.pricePesewas)}<small>{item.optionGroups.length ? ' / from' : ''}</small></strong>{item.spicy && <span className="spicy"><Flame size={13} />Spicy</span>}</div>{!item.available ? <p className="availability-note">{item.unavailableReason}</p> : daypart && item.dayparts.length>0 && !item.dayparts.includes(daypart) && view === 'all' ? <p className="daypart-hint">Usually enjoyed at {labels[item.dayparts[0]!].toLowerCase()}</p> : null}</div></article>)}</div>
    {!menuQuery.isPending && !menuQuery.error && !filtered.length && <div className="empty"><span className="empty-icon"><Search size={28} /></span><h3>No dishes match just yet.</h3><p>Try another search or explore the full menu.</p><Button onClick={reset}>Show the whole menu<ArrowRight size={17} /></Button></div>}
    <p className="menu-disclaimer">Sample dishes, recipes and prices for this local preview. <Link href="/photo-credits">Illustrative food photography <ArrowUpRight size={12} /></Link></p></section>
    <section className="story" id="story"><div className="story-symbol"><UtensilsCrossed size={40} /></div><div><p className="eyebrow">OUR ROOTS. YOUR FAVOURITES.</p><h2>{copy.storyTitle}</h2></div><p>{copy.storyDescription}</p></section></main>
    <footer><Brand logo={company.data?.logo} /><p>Good food. Ghanaian soul.</p><Link href="/photo-credits">Photo credits<ArrowUpRight size={13} /></Link><small>Accra, Ghana. Development preview.</small></footer>
    <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#menu"><UtensilsCrossed size={20} />Menu</a><Link href="/orders"><Clock3 size={20}/>Orders</Link><Link href="/account"><ChefHat size={20}/>Account</Link><button onClick={openBag} aria-label={`Open bag, ${basket.count} items`}><span><ShoppingBag size={20} />{basket.count > 0 && <b>{basket.count}</b>}</span>Bag</button></nav>
    {basket.count > 0 && !bagOpen && !selected && <button className="floating-bag" onClick={openBag}><span className="cart-count">{basket.count}</span><span>View your bag<small>{mode} from {kitchenName}</small></span><strong>{formatMoney(basket.total)}<ArrowRight size={18} /></strong></button>}
    {added && <div className="toast" role="status"><Check size={17} /><span>{added} added to your bag.</span><button onClick={() => { openBag(); setAdded(''); }}>View bag</button><button aria-label="Dismiss confirmation" onClick={() => setAdded('')}><X size={16} /></button></div>}
    {basket.notice && <div className="storage-notice" role="status">{basket.notice}<button aria-label="Dismiss basket notice" onClick={basket.dismissNotice}><X size={18} /></button></div>}
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><Dialog.Portal><Dialog.Overlay className="overlay" />{selected && <MealSheet key={selected.id} item={selected} close={() => setSelected(null)} restoreFocus={restoreFocus} add={async selection => { await basket.add(selection); if(branchId)void api('/recommendations/events',{method:'POST',body:JSON.stringify({branchId,events:[{itemId:selected.id,kind:'add',source:recommendationSource}]})}).catch(()=>{});setAdded(selected.name); }} />}</Dialog.Portal></Dialog.Root>
    <Dialog.Root open={bagOpen} onOpenChange={setBagOpen}><Dialog.Portal><Dialog.Overlay className="overlay" /><Dialog.Content className="sheet bag-sheet" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}><div className="sheet-head"><div><p className="eyebrow">YOU HAVE GOOD TASTE.</p><Dialog.Title>{copy.bagTitle}{basket.count > 0 ? ` (${basket.count})` : ''}</Dialog.Title></div><Dialog.Close className="icon-button" aria-label="Close bag"><X size={22} /></Dialog.Close></div><Dialog.Description className="sheet-description">{mode} from {kitchenName}. Local preview.</Dialog.Description><div className="bag-lines">{basket.lines.length ? basket.lines.map(line => <article className="bag-line" key={line.key}><div className="bag-line-photo"><Image src={line.item.image} alt="" fill sizes="80px" /></div><div className="bag-line-info"><h3>{line.item.name}</h3>{!line.item.available&&<p className="inline-error">{line.item.unavailableReason||'This dish is unavailable. Remove it before checkout.'}</p>}{line.options.length > 0 && <p>{line.options.map(option => option.name).join(', ')}</p>}{line.note && <p className="saved-note">Note: {line.note}</p>}<b>{formatMoney(line.unitPricePesewas * line.quantity)}</b><div className="stepper"><button aria-label={`Remove one ${line.item.name}`} onClick={() => basket.change(line.key, -1)}><Minus size={15} /></button><span>{line.quantity}</span><button aria-label={`Add one ${line.item.name}`} disabled={line.quantity >= 20} onClick={() => basket.change(line.key, 1)}><Plus size={15} /></button></div></div><button className="icon-button" aria-label={`Remove ${line.item.name} from bag`} onClick={() => basket.remove(line.key)}><X size={17} /></button></article>) : <div className="empty"><span className="empty-icon"><ShoppingBag size={30} /></span><h3>Something delicious belongs here.</h3><p>Choose a dish, make it yours and add it to your bag.</p><Dialog.Close asChild><Button className="primary">Explore the menu<ArrowRight size={17} /></Button></Dialog.Close></div>}</div> {branchId&&basket.count>0&&recommendationGroups.filter(group=>group.source==='together').map(group=><RecommendationShelf key={group.source} group={group} branchId={branchId} onChoose={(item,source)=>{setBagOpen(false);openMeal(item,source);}}/>)}<div className="bag-summary"><div><span>Subtotal</span><strong data-testid="basket-total">{formatMoney(basket.total)}</strong></div><p>Delivery fees are calculated for your pin at checkout.</p><div className="preview-note"><b><ChefHat size={17} />Demo kitchen</b><p>Your order will be saved in the local system. Online payments are simulated.</p></div>{basket.count>0&&<Link href="/checkout" className="button primary" onClick={()=>setBagOpen(false)}>Continue to checkout<ArrowRight size={17}/></Link>}<Dialog.Close asChild><Button className="primary">Keep exploring<ArrowRight size={17} /></Button></Dialog.Close><span className="save-caption"><Check size={14} />Saved securely on the server.</span></div></Dialog.Content></Dialog.Portal></Dialog.Root>
    <BranchChooser key={basket.data?.fulfillment} open={kitchenOpen} onOpenChange={setKitchenOpen} branches={branches.data||[]} cart={basket.data} update={basket.update} restoreFocus={restoreFocus}/>
    <span className="sr-only" role="status" aria-live="polite">{basket.count} items in your bag. Subtotal {formatMoney(basket.total)}.</span>
  </div>;
}
