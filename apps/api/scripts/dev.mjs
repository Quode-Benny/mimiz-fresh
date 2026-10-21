import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const child=spawn(process.execPath,[require.resolve('tsx/cli'),'watch','--include','src/**/*.ts','src/main.ts'],{
 stdio:'inherit',windowsHide:true,env:{...process.env,CHOKIDAR_USEPOLLING:'true',CHOKIDAR_INTERVAL:'500'},
});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',code=>process.exit(code||0));
