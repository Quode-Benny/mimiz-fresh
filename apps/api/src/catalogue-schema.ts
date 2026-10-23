import {z} from 'zod';
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const catalogueFields={
 image:z.string().regex(/^\/(images|api\/v1\/uploads)\//).optional(),
 vegetarian:z.boolean().optional(),spicy:z.boolean().optional(),featured:z.boolean().optional(),
 tags:z.array(z.string().trim().min(1).max(40)).max(20).optional(),
 allergens:z.array(z.string().trim().min(1).max(80)).max(20).optional(),
 sortOrder:z.number().int().min(0).max(10000).optional(),
 dayparts:z.array(z.enum(['breakfast','lunch','afternoon','dinner','late_night'])).max(5).optional(),
 availabilityWindows:z.array(z.object({days:z.array(z.number().int().min(0).max(6)).min(1).max(7),open:time,close:time})).max(14).optional(),
 optionGroups:z.array(z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),minimum:z.number().int().min(0).max(20),maximum:z.number().int().min(1).max(20),options:z.array(z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),priceDeltaPesewas:z.number().int().min(0).max(1000000),isDefault:z.boolean().optional()})).min(1).max(50)})).max(12).superRefine((groups,ctx)=>{const ids=new Set<string>();for(const group of groups){if(ids.has(group.id))ctx.addIssue({code:'custom',message:'Use unique option group IDs.'});ids.add(group.id);if(group.minimum>group.maximum||group.maximum>group.options.length)ctx.addIssue({code:'custom',message:'Option limits must fit the available choices.'});for(const option of group.options){if(ids.has(option.id))ctx.addIssue({code:'custom',message:'Use unique IDs for every option.'});ids.add(option.id);}}}).optional()
};
