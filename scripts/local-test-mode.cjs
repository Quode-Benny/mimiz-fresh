function assertLocalTestMode(env=process.env){
 if(env.NODE_ENV==='production'||env.OTP_DEMO_MODE!=='true'||(env.PAYMENT_PROVIDER||'mock')!=='mock'||(env.SMS_PROVIDER||'console')!=='console'||(env.EMAIL_PROVIDER||'console')!=='console'||(env.STORAGE_PROVIDER||'local')!=='local'||(env.ERROR_PROVIDER||'console')!=='console'||(env.MAPS_PROVIDER||'osm')!=='osm')throw new Error('Test reset requires local demo providers and demo OTP; live services are refused.');
}
module.exports={assertLocalTestMode};
