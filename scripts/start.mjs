import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','0.0.0.0','-p',process.env.PORT||'3000'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
