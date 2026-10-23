export const orderStatuses = ['pending_payment', 'placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'rejected'] as const;
export type OrderStatus = typeof orderStatuses[number];
export const transitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['placed', 'cancelled'], placed: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed'], completed: [], cancelled: [], rejected: [],
};
export type Daypart = 'breakfast' | 'lunch' | 'afternoon' | 'dinner' | 'late_night';
export type MenuOption = { id: string; name: string; priceDeltaPesewas: number; isDefault?: boolean };
export type OptionGroup = { id: string; name: string; minimum: number; maximum: number; options: MenuOption[] };
export type MenuItem = {
  id: string; name: string; description: string; category: string; pricePesewas: number;
  image: string; badge?: string; featured?:boolean; tags?:string[]; sortOrder?:number; stock?:number|null; companyPricePesewas?:number; branchPricePesewas?:number|null; availabilityWindows?:{days:number[];open:string;close:string}[]; dayparts: Daypart[]; vegetarian?: boolean; spicy?: boolean;
  available: boolean; unavailableReason?: string; allergens?: string[]; optionGroups: OptionGroup[];
};
export type BasketSelection = { itemId: string; optionIds: string[]; quantity: number; note: string };
export type PricedBasketLine = BasketSelection & { key: string; item: MenuItem; unitPricePesewas: number; options: MenuOption[] };

export const roleActions:Readonly<Record<string,readonly OrderStatus[]>>={
 kitchen_staff:['accepted','rejected','preparing','ready'],rider:['out_for_delivery','completed'],support_agent:['cancelled'],customer:['cancelled']
};
