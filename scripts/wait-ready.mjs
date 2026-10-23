const urls=['http://localhost:3002','http://127.0.0.1:4000/api/v1/health'];
for(let attempt=0;attempt<120;attempt++){
 const ready=await Promise.all(urls.map(async url=>{try{return (await fetch(url,{signal:AbortSignal.timeout(3000)})).ok;}catch{return false;}}));
 if(ready.every(Boolean)){console.log('Web and API are ready.');process.exit(0);}
 await new Promise(resolve=>setTimeout(resolve,1000));
}
console.error('Web/API readiness timed out.');process.exit(1);
