import {describe,it,expect} from 'vitest';
import {mealRequest} from './meal-request';
type MenuItem={id:string;name:string};
const menu=[{id:'sobolo',name:'Chilled sobolo'},{id:'ampesi',name:'Ampesi & kontomire'},{id:'yam',name:'Fried yam & pepper'}] as MenuItem[];
describe('customer ordering intent',()=>{
 it('handles the actual sobolo and two ampesi requests',()=>{
  expect(mealRequest('can you order the sobolo for me?',[],menu)?.suggestions).toEqual([{itemId:'sobolo',name:'Chilled sobolo',quantity:1}]);
  expect(mealRequest('i want Ampesi & kontomire , 2 of that',[],menu)?.suggestions[0]).toMatchObject({itemId:'ampesi',quantity:2});
 });
 it('resolves a quantity follow-up from customer context',()=>{expect(mealRequest('make that two please',['can you order sobolo for me?'],menu)?.suggestions[0]).toMatchObject({itemId:'sobolo',quantity:2});});
 it('does not treat FAQ questions or prices as an order',()=>{expect(mealRequest('What vegetarian dishes are available?',[],menu)).toBeNull();expect(mealRequest('How much is 2 sobolo?',[],menu)).toBeNull();});
 it('requires a valid bounded quantity and never invents an unknown dish',()=>{expect(mealRequest('I want 21 sobolo',[],menu)?.error).toBeTruthy();expect(mealRequest('I want pizza',[],menu)?.suggestions).toEqual([]);});
});
