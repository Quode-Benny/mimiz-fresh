const {spawnSync}=require('node:child_process');
const modes=[{NODE_ENV:'production'},{PAYMENT_PROVIDER:'paystack'},{SMS_PROVIDER:'hubtel'},{EMAIL_PROVIDER:'resend'},{STORAGE_PROVIDER:'s3'},{ERROR_PROVIDER:'sentry'},{MAPS_PROVIDER:'google'},{OTP_DEMO_MODE:'false'}];
for(const mode of modes){
 const result=spawnSync(process.execPath,['scripts/reset-test-limits.cjs'],{env:{...process.env,...mode},windowsHide:true,encoding:'utf8'});
 if(result.error||result.status!==1||!result.stderr.includes('live services are refused')||result.stdout.includes('Reset only'))throw Error('Test safety refusal did not hold for '+Object.keys(mode)[0]);
}
console.log('Test safety passed: production, live payments/SMS/email, cloud storage/errors/maps and non-demo OTP all refuse rate resets before connecting.');
