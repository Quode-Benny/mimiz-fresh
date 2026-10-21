import type { MenuItem, OptionGroup } from './index';
// Fictional sample catalogue. Business prices and recipes require owner approval.
const protein: OptionGroup = { id: 'protein', name: 'Choose your protein', minimum: 1, maximum: 1, options: [
  { id: 'chicken', name: 'Grilled chicken', priceDeltaPesewas: 0, isDefault: true },
  { id: 'fish', name: 'Fried fish', priceDeltaPesewas: 1000 },
  { id: 'beef', name: 'Beef', priceDeltaPesewas: 1500 },
] };
const extras: OptionGroup = { id: 'extras', name: 'A little extra', minimum: 0, maximum: 2, options: [
  { id: 'egg', name: 'Boiled egg', priceDeltaPesewas: 500 },
  { id: 'plantain', name: 'Fried plantain', priceDeltaPesewas: 1000 },
  { id: 'shito', name: 'Extra shito', priceDeltaPesewas: 300 },
] };
const soup: OptionGroup = { id: 'soup', name: 'Choose your soup', minimum: 1, maximum: 1, options: [
  { id: 'light', name: 'Light soup with goat', priceDeltaPesewas: 0, isDefault: true },
  { id: 'groundnut', name: 'Groundnut soup with chicken', priceDeltaPesewas: 500 },
] };
const image = (id: string) => `/images/menu/${id}.webp`;
export const demoMenu: MenuItem[] = [
  { id: 'jollof', name: 'Smoky Ghana jollof', description: 'Tomato-rich rice, grilled chicken, slaw and house shito.', category: 'Rice favourites', pricePesewas: 6500, image: image('jollof'), badge: 'KITCHEN PICK', dayparts: ['lunch','dinner'], available: true, spicy: true, allergens: ['Fish in shito', 'Egg in slaw'], optionGroups: [protein, extras] },
  { id: 'waakye', name: 'Waakye, the full works', description: 'Rice and beans, beef, gari, spaghetti, egg and shito.', category: 'Rice favourites', pricePesewas: 5500, image: image('waakye'), badge: 'A GHANAIAN CLASSIC', dayparts: ['breakfast','lunch'], available: true, allergens: ['Wheat', 'Egg', 'Fish in shito'], optionGroups: [extras] },
  { id: 'banku', name: 'Banku & grilled tilapia', description: 'Two balls of banku, whole tilapia and fresh pepper sauce.', category: 'Local classics', pricePesewas: 9500, image: image('banku'), dayparts: ['lunch','dinner'], available: true, spicy: true, allergens: ['Fish'], optionGroups: [] },
  { id: 'red-red', name: 'Red red & ripe plantain', description: 'Black-eyed bean stew, sweet fried plantain and a sprinkle of gari.', category: 'Local classics', pricePesewas: 4500, image: image('red-red'), dayparts: ['lunch','dinner'], available: true, vegetarian: true, optionGroups: [] },
  { id: 'fufu', name: 'Fufu & light soup', description: 'Soft cassava-plantain fufu in a warming goat light soup.', category: 'Soups & swallows', pricePesewas: 7500, image: image('fufu'), dayparts: ['lunch','dinner'], available: true, spicy: true, allergens: ['Groundnuts if groundnut soup selected'], optionGroups: [soup] },
  { id: 'omo-tuo', name: 'Omo tuo & groundnut soup', description: 'Soft rice balls with rich groundnut soup and chicken.', category: 'Soups & swallows', pricePesewas: 6500, image: image('omo-tuo'), dayparts: ['lunch','dinner'], available: true, allergens: ['Groundnuts'], optionGroups: [] },
  { id: 'tuo-zaafi', name: 'Tuo zaafi & ayoyo', description: 'Soft maize swallow with ayoyo, tomato stew and beef.', category: 'Soups & swallows', pricePesewas: 6000, image: image('tuo-zaafi'), dayparts: ['lunch','dinner'], available: true, optionGroups: [] },
  { id: 'ampesi', name: 'Ampesi & kontomire', description: 'Boiled yam and plantain, leafy kontomire stew and boiled egg.', category: 'Local classics', pricePesewas: 5000, image: image('ampesi'), dayparts: ['lunch','dinner'], available: true, allergens: ['Egg', 'Fish in stew'], optionGroups: [] },
  { id: 'kenkey', name: 'Ga kenkey & fried fish', description: 'Fermented maize kenkey with crisp fish and freshly ground pepper.', category: 'Local classics', pricePesewas: 5000, image: image('kenkey'), dayparts: ['lunch','dinner'], available: true, spicy: true, allergens: ['Fish'], optionGroups: [] },
  { id: 'hausa-koko', name: 'Hausa koko & koose', description: 'Warm spiced millet porridge with crisp black-eyed bean fritters.', category: 'Breakfast', pricePesewas: 2500, image: image('hausa-koko'), dayparts: ['breakfast'], available: true, vegetarian: true, optionGroups: [] },
  { id: 'kelewele', name: 'Kelewele & groundnuts', description: 'Ginger-spiced ripe plantain with roasted groundnuts on the side.', category: 'Sides & drinks', pricePesewas: 2500, image: image('kelewele'), dayparts: ['afternoon','dinner','late_night'], available: true, vegetarian: true, spicy: true, allergens: ['Groundnuts'], optionGroups: [] },
  { id: 'fried-yam', name: 'Fried yam & pepper', description: 'Golden yam chips with fresh pepper and a little house shito.', category: 'Sides & drinks', pricePesewas: 3000, image: image('fried-yam'), dayparts: ['afternoon','dinner'], available: true, allergens: ['Fish in shito'], optionGroups: [] },
  { id: 'sobolo', name: 'Chilled sobolo', description: 'Hibiscus, ginger and a hint of cloves. Served chilled, 350 ml.', category: 'Sides & drinks', pricePesewas: 1500, image: image('sobolo'), dayparts: ['lunch','afternoon','dinner'], available: true, vegetarian: true, optionGroups: [] },
  { id: 'asana', name: 'Asana', description: 'A chilled caramelised maize drink. A familiar local favourite, 350 ml.', category: 'Sides & drinks', pricePesewas: 1500, image: image('asana'), dayparts: ['lunch','afternoon'], available: false, unavailableReason: 'Unavailable in this sample menu', vegetarian: true, optionGroups: [] },
];
export const menuCategories = ['Everything', 'Rice favourites', 'Local classics', 'Soups & swallows', 'Breakfast', 'Sides & drinks'];
