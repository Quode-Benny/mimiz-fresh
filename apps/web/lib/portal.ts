export type Portal = 'customer'|'staff'|'admin'|'rider';
export function portalForPath(path:string):Portal {
 if(/^\/admin(\/|$)/.test(path))return 'admin';
 if(/^\/rider(\/|$)/.test(path))return 'rider';
 if(/^\/(staff|kitchen)(\/|$)/.test(path))return 'staff';
 return 'customer';
}
export const portalRoles:Record<Portal,string[]> = {customer:['customer'],staff:['super_admin','branch_manager','kitchen_staff','support_agent'],admin:['super_admin','branch_manager'],rider:['rider']};
