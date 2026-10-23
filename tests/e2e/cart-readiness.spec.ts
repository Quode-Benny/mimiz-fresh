import {test,expect} from './fixtures';
test.describe('slow cart startup',()=>{
 test.use({serviceWorkers:'block'});
 test('ordering preferences wait for a loaded cart and persist only after saving',async({page})=>{
  let releaseRead!:()=>void,releaseWrite!:()=>void,readReleased=false,writeReleased=false;
  const readGate=new Promise<void>(resolve=>{releaseRead=()=>{readReleased=true;resolve();};}),writeGate=new Promise<void>(resolve=>{releaseWrite=()=>{writeReleased=true;resolve();};});
  await page.route('**/api/v1/cart',async route=>{if(route.request().method()==='GET'&&!readReleased)await readGate;if(route.request().method()==='PUT'&&!writeReleased)await writeGate;await route.continue();});
  try{
   await page.goto('/');const pickup=page.locator('.order-strip').getByRole('button',{name:'Pickup',exact:true});
   await expect(pickup).toBeDisabled();releaseRead();await expect(pickup).toBeEnabled();
   await pickup.click();await expect(pickup).toBeDisabled();await expect(pickup).toHaveAttribute('aria-pressed','false');
   releaseWrite();await expect(pickup).toHaveAttribute('aria-pressed','true');await expect(pickup).toBeEnabled();
   await page.reload();await expect(pickup).toHaveAttribute('aria-pressed','true');
  }finally{releaseRead();releaseWrite();}
 });
});
