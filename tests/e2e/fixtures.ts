import {test as base} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export {expect,request} from '@playwright/test';
// Each local test owns a fresh rate-limit window. The reset script refuses
// production and deletes only this development project's rate-counter keys.
// Limits remain active within a test, including explicit abuse-limit checks.
export const test=base.extend<{localRateWindow:void}>({
 localRateWindow:[async({request},use)=>{const response=await request.get('/api/v1/config');const settings=await response.json();if(!response.ok()||settings.safeAcceptance!==true)throw new Error('Acceptance tests require a local demo API with mock/console/local providers; live services are refused.');await promisify(execFile)(process.execPath,['scripts/reset-test-limits.cjs'],{windowsHide:true});await use();},{auto:true}]
});
