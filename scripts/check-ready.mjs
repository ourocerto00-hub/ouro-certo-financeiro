import {existsSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const major=Number(process.versions.node.split('.')[0]);
const checks=[
 ['Node.js 22.13+',major>=22],
 ['package.json',existsSync(new URL('../package.json',import.meta.url))],
 ['package-lock.json',existsSync(new URL('../package-lock.json',import.meta.url))],
 ['vinext instalado',existsSync(new URL('../node_modules/vinext/dist/cli.js',import.meta.url))],
 ['wrangler instalado',existsSync(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url))],
];
console.log('Pré-verificação Ouro Certo',pkg.version);
for(const [label,ok] of checks) console.log(`${ok?'OK':'PENDENTE'}: ${label}`);
const t=spawnSync(process.execPath,['--test','app/engine.test.mjs','app/file-validation.test.mjs'],{cwd:new URL('../',import.meta.url),stdio:'inherit'});
if(t.status!==0) process.exitCode=1;
if(checks.some(([,ok])=>!ok)) process.exitCode=1;
