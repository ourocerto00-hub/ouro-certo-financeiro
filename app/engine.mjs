export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((v||0)/100);
export function cents(v){let s=String(v??'').trim().replace(/\s|R\$/g,''); if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Informe um valor válido com até duas casas decimais.');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>1e13)throw Error('Valor fora do limite.');return n;}
const must=(v,msg)=>{if(!v)throw Error(msg);};
const id=()=>crypto.randomUUID();
const positive=v=>{const n=cents(v);must(n>0,'O valor deve ser maior que zero.');return n;};
const text=(v,label)=>{const t=String(v||'').trim();must(t&&t.length<=500,`Informe ${label} (até 500 caracteres).`);return t;};
const date=v=>{must(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Data inválida.');return v;};
const period=v=>{must(/^\d{4}-(0[1-9]|1[0-2])$/.test(v),'Mês inválido.');return v;};
export function initial(email=''){
 return {units:['Matriz','Sorriso','Nova Mutum','Campo Novo dos Parecis','Tangará da Serra','Vilhena','Cacoal'].map((name,i)=>({id:'u'+i,name,city:i?name:'Sede',state:i>4?'RO':'MT',type:i?'Filial':'Matriz',active:true})),categories:['Aluguel','Energia','Internet','Marketing','Combustível','Manutenção','Despesas administrativas','Salários'].map((name,i)=>({id:'c'+i,name,active:true})),accounts:[{id:'gold',name:'Nubank — Ouro Certo',purpose:'gold',opening:0,date:today()},{id:'pay',name:'Nubank — Ouro Passo',purpose:'pay',opening:0,date:today()}],employees:[],bills:[],movements:[],advances:[],payroll:[],closings:[],rates:[{month:'2000-01',value:1000}],users:email?[{id:id(),name:email,email,active:true}]:[]};
}
export const active=x=>!x.cancelled;
// Contas Pagas is a view of the ledger, never a second payment table.
export const paidMovements=s=>s.movements.filter(m=>active(m)&&m.amount<0&&['expense','bill','advance','salary'].includes(m.kind));
export function cashSummary(s,account,from,to=from){
 if(from>to)throw Error('Período inválido.');
 const a=s.accounts.find(x=>x.id===account);if(!a)throw Error('Conta não encontrada.');
 const opening=(a.date<=to?a.opening:0)+s.movements.filter(m=>m.account===account&&m.date<from&&active(m)).reduce((n,m)=>n+m.amount,0);
 const ms=s.movements.filter(m=>m.account===account&&m.date>=from&&m.date<=to&&active(m));
 const entries=ms.reduce((n,m)=>n+Math.max(0,m.amount),0),exits=ms.reduce((n,m)=>n-Math.min(0,m.amount),0);
 return {opening,entries,exits,expected:opening+entries-exits};
}
export const balance=(s,account,until='9999-12-31')=>{const a=s.accounts.find(x=>x.id===account);return (a&&a.date<=until?a.opening:0)+s.movements.filter(x=>x.account===account&&x.date<=until&&active(x)).reduce((n,x)=>n+x.amount,0);};
export const billPaid=(s,b)=>s.movements.filter(x=>x.bill===b.id&&active(x)).reduce((n,x)=>n-x.amount,0);
export const advancePaid=(s,p)=>s.advances.filter(x=>x.employee===p.employee&&x.month===p.month&&active(x)).reduce((n,x)=>n+x.amount,0);
export const salaryPaid=(s,p)=>s.movements.filter(x=>x.payroll===p.id&&x.kind==='salary'&&active(x)).reduce((n,x)=>n-x.amount,0);
export const remuneration=p=>p.salary+(p.grams===null?0:Math.round(p.grams*p.rate/1000));
export const salaryDue=(s,p)=>Math.max(0,remuneration(p)-advancePaid(s,p)-salaryPaid(s,p));
export function summary(s,month,unit='all'){
 const filter=x=>unit==='all'||x.unit===unit;
 const bs=s.bills.filter(x=>active(x)&&x.date.startsWith(month)&&filter(x));
 const ps=s.payroll.filter(x=>x.month===month&&filter(x));
 const daily=s.movements.filter(x=>active(x)&&x.kind==='expense'&&x.date.startsWith(month)&&filter(x));
 const total=bs.reduce((n,b)=>n+b.amount,0)+ps.reduce((n,p)=>n+remuneration(p),0)+daily.reduce((n,m)=>n-m.amount,0);
 const pending=bs.reduce((n,b)=>n+Math.max(0,b.amount-billPaid(s,b)),0)+ps.reduce((n,p)=>n+salaryDue(s,p),0);
 const paid=paidMovements(s).filter(x=>x.date.startsWith(month)&&filter(x)).reduce((n,m)=>n-m.amount,0);
 const advances=s.advances.filter(x=>active(x)&&x.date.startsWith(month)&&filter(x)).reduce((n,x)=>n+x.amount,0);
 return {total,pending,paid,advances,gold:s.accounts.filter(x=>x.purpose==='gold').reduce((n,a)=>n+balance(s,a.id),0),pay:s.accounts.filter(x=>x.purpose==='pay').reduce((n,a)=>n+balance(s,a.id),0)};
}
function ensurePeriod(s,month){period(month);for(const e of s.employees.filter(x=>x.active&&x.admission.slice(0,7)<=month)){if(!s.payroll.some(p=>p.employee===e.id&&p.month===month)){const rate=[...s.rates].filter(r=>r.month<=month).sort((a,b)=>b.month.localeCompare(a.month))[0]?.value||1000;s.payroll.push({id:id(),employee:e.id,unit:e.unit,month,salary:e.salary,grams:null,rate,confirmed:false,notes:''});}}
 for(const b of [...s.bills].filter(x=>x.recurring&&active(x)&&!x.parent&&x.date.slice(0,7)<month)){
   const [year,mon]=b.date.slice(0,7).split('-').map(Number);
   let y=year,m=mon+1;
   while(y*12+m<=Number(month.slice(0,4))*12+Number(month.slice(5))){
    if(m>12){m=1;y++;}
    const periodKey=`${y}-${String(m).padStart(2,'0')}`;
    if(periodKey>month)break;
    if(!s.bills.some(x=>x.parent===b.id&&x.date.startsWith(periodKey))){
     const d=Math.min(Number(b.date.slice(8)),new Date(y,m,0).getDate());
     s.bills.push({...b,id:id(),parent:b.id,date:periodKey+'-'+String(d).padStart(2,'0'),recurring:false});
    }
    m++;
   }
  }
}
export function apply(source,op,input,actor){
 const s=structuredClone(source),v={...input};
 const get=(table,key)=>{const x=s[table].find(x=>x.id===key);must(x,`Registro não encontrado: ${table}.`);return x;};
 const unit=()=>{const x=get('units',v.unit);must(x.active,'Unidade inativa.');return x.id;};
 const account=(key=v.account,purpose)=>{const a=get('accounts',key);if(purpose)must(a.purpose===purpose,'Selecione uma conta com a finalidade correta.');return a;};
 const unlocked=(a,d)=>{must(!s.closings.some(c=>c.account===a&&c.date>=d&&!c.reopened),'Período encerrado. Reabra o fechamento com justificativa antes de alterar.');};
 const move=m=>{date(m.date);const a=account(m.account);must(m.date>=a.date,'A data é anterior ao saldo inicial da conta.');unlocked(m.account,m.date);s.movements.push({id:id(),actor,...m});};
 const category=()=>{const c=get('categories',v.category);must(c.active,'Categoria inativa.');return c.id;};
 if(op==='period'){ensurePeriod(s,period(v.month));}
 else if(op==='unit'||op==='category'){
  const table=op==='unit'?'units':'categories',name=text(v.name,'o nome');must(!s[table].some(x=>x.id!==v.id&&x.name.toLocaleLowerCase()===name.toLocaleLowerCase()),'Já existe um cadastro com esse nome.');
  const x=v.id?get(table,v.id):{id:id(),active:true};Object.assign(x,{name,active:v.active!==false});if(op==='unit')Object.assign(x,{city:text(v.city,'a cidade'),state:text(v.state,'o estado'),type:v.type==='Matriz'?'Matriz':'Filial'});if(!v.id)s[table].push(x);
 }
 else if(op==='user'){const email=text(v.email,'o e-mail').toLowerCase();must(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'E-mail inválido.');must(!s.users.some(x=>x.email===email&&x.id!==v.id),'Usuário já cadastrado.');if(v.id){const u=get('users',v.id);must(u.email!==actor||v.active!==false,'Você não pode desativar o próprio acesso.');Object.assign(u,{name:text(v.name,'o nome'),email,active:v.active!==false});}else s.users.push({id:id(),name:text(v.name,'o nome'),email,active:true});}
 else if(op==='rate'){const month=period(v.month);must(month>=today().slice(0,7),'Não é permitido alterar a taxa de meses anteriores.');must(!s.rates.some(r=>r.month===month),'Já existe uma taxa para esse mês. Use um mês futuro.');s.rates.push({month,value:positive(v.value)});}
 else if(op==='account'){
  const name=text(v.name,'o nome');must(['gold','pay'].includes(v.purpose),'Finalidade inválida.');if(v.id){const a=account(v.id);a.name=name;must(a.purpose===v.purpose||!s.movements.some(m=>m.account===a.id),'Uma conta com histórico não pode mudar de finalidade.');a.purpose=v.purpose;if(v.opening!==undefined){must(!s.movements.some(m=>m.account===a.id)&&!s.closings.some(c=>c.account===a.id),'Saldo inicial só pode ser alterado antes das movimentações.');a.opening=cents(v.opening);a.date=date(v.date);}}else s.accounts.push({id:id(),name,purpose:v.purpose,opening:cents(v.opening),date:date(v.date)});
 }
 else if(op==='employee'){
  const x=v.id?get('employees',v.id):{id:id()};Object.assign(x,{name:text(v.name,'o nome'),unit:unit(),role:text(v.role,'o cargo'),salary:cents(v.salary),admission:date(v.admission),active:v.active!==false,notes:v.notes||''});if(!v.id)s.employees.push(x);ensurePeriod(s,v.month||today().slice(0,7));
 }
 else if(op==='bill'){
  const x=v.id?get('bills',v.id):{id:id()};if(v.id){must(!x.cancelled,'Conta cancelada.');must(billPaid(s,x)===0,'Uma conta com pagamentos não pode ser alterada. Cancele os pagamentos antes.');must(v.reason?.trim(),'Justifique a alteração.');}
  Object.assign(x,{name:text(v.name,'o nome da conta'),description:text(v.description||v.name,'a descrição'),unit:unit(),category:category(),amount:positive(v.amount),date:date(v.date),recurring:!!v.recurring,notes:v.notes||'',attachment:v.attachment||null});if(!v.id)s.bills.push(x);
 }
 else if(op==='paybill'){
  const b=get('bills',v.id);must(active(b),'Conta cancelada.');const amount=positive(v.amount);must(amount<=b.amount-billPaid(s,b),'Pagamento maior que o saldo pendente.');account(v.account,'pay');move({date:date(v.date),account:v.account,amount:-amount,description:b.name,kind:'bill',unit:b.unit,category:b.category,bill:b.id,attachment:v.attachment||null});
 }
 else if(op==='movement'){
  const a=account();const d=date(v.date),amount=positive(v.amount);must(['in','out'].includes(v.direction),'Tipo inválido.');const outgoing=v.direction==='out';
  move({date:d,account:a.id,amount:outgoing?-amount:amount,description:text(v.description,'a descrição'),kind:outgoing?(a.purpose==='pay'?'expense':'gold'):'income',unit:outgoing&&a.purpose==='pay'?unit():(v.unit||null),category:outgoing&&a.purpose==='pay'?category():null,origin:outgoing?'':text(v.origin,'a origem financeira'),attachment:v.attachment||null});
 }
 else if(op==='transfer'){
  must(v.account!==v.destination,'Selecione duas contas diferentes.');account(v.destination);const amount=positive(v.amount),transfer=id(),description=text(v.description,'a descrição');move({date:date(v.date),account:v.account,amount:-amount,description,kind:'transfer',transfer});move({date:v.date,account:v.destination,amount,description,kind:'transfer',transfer});
 }
 else if(op==='advance'){
  const e=get('employees',v.employee);must(e.active,'Funcionário inativo.');const month=period(v.month);ensurePeriod(s,month);const p=s.payroll.find(x=>x.employee===e.id&&x.month===month);must(p,'Não há salário para esse período.');const amount=positive(v.amount);account(v.account,'pay');const a={id:id(),employee:e.id,unit:e.unit,date:date(v.date),month,amount,description:text(v.description,'a descrição'),account:v.account,actor,attachment:v.attachment||null};move({account:v.account,amount:-amount,date:a.date,description:a.description,unit:e.unit,employee:e.id,advance:a.id,kind:'advance',attachment:a.attachment});s.advances.push(a);
 }
 else if(op==='grams'){
  const p=get('payroll',v.id);must(!p.confirmed,'Reabra a conferência antes de alterar as gramas.');must(!salaryPaid(s,p),'Cancele os pagamentos salariais antes de recalcular.');const raw=String(v.grams).replace(',','.');must(/^\d+(\.\d{1,3})?$/.test(raw),'Informe gramas com até três casas decimais; confirme 0 se necessário.');if(p.grams!==null)must(v.reason?.trim(),'Justifique a alteração de gramas.');p.grams=Math.round(Number(raw)*1000);must(Number.isSafeInteger(p.grams)&&p.grams<1e9,'Quantidade fora do limite.');p.notes=v.notes||'';
 }
 else if(op==='confirmSalary'){const p=get('payroll',v.id);must(p.grams!==null,'Informe as gramas, mesmo que sejam zero.');p.confirmed=true;}
 else if(op==='reopenSalary'){const p=get('payroll',v.id);must(v.reason?.trim(),'Justifique a reabertura.');must(!salaryPaid(s,p),'Cancele os pagamentos antes de reabrir.');p.confirmed=false;}
 else if(op==='paySalary'){const p=get('payroll',v.id);must(p.confirmed,'Confira a comissão antes de pagar.');const amount=positive(v.amount);must(amount<=salaryDue(s,p),'Pagamento maior que o saldo salarial.');account(v.account,'pay');move({account:v.account,amount:-amount,date:date(v.date),description:'Salário • '+get('employees',p.employee).name,kind:'salary',unit:p.unit,employee:p.employee,payroll:p.id,attachment:v.attachment||null});}
 else if(op==='close'){
  const a=account(),d=date(v.date);must(!s.closings.some(x=>x.account===a.id&&x.date===d&&!x.reopened),'Este caixa já está fechado.');must(!s.closings.some(x=>x.account===a.id&&x.date>d&&!x.reopened),'Existe um fechamento posterior.');const expected=balance(s,a.id,d),real=cents(v.real),difference=real-expected;must(difference===0||v.reason?.trim(),'Informe a justificativa da divergência.');s.closings.push({id:id(),account:a.id,date:d,expected,real,difference,reason:v.reason||'',actor,createdAt:new Date().toISOString()});
 }
 else if(op==='reopen'){const c=get('closings',v.id);must(v.reason?.trim(),'Justifique a reabertura.');must(!s.closings.some(x=>x.account===c.account&&x.date>c.date&&!x.reopened),'Reabra primeiro os fechamentos posteriores.');c.reopened=true;c.reopenReason=v.reason;}
 else if(op==='cancel'){
  must(['bills','movements','advances'].includes(v.table),'Tipo de cancelamento inválido.');
  must(v.reason?.trim(),'Informe a justificativa do cancelamento.');if(v.table==='bills'){const b=get('bills',v.id);must(!billPaid(s,b),'Cancele os pagamentos antes de cancelar a conta.');b.cancelled=true;b.reason=v.reason;}else {const m=v.table==='advances'?s.movements.find(x=>x.advance===v.id):get('movements',v.id);must(m&&active(m),'Movimentação já cancelada ou inexistente.');const list=m.transfer?s.movements.filter(x=>x.transfer===m.transfer):[m];for(const x of list){unlocked(x.account,x.date);x.cancelled=true;x.reason=v.reason;if(x.advance){const a=get('advances',x.advance);a.cancelled=true;a.reason=v.reason;}}}
 }
 else throw Error('Operação desconhecida.');
 return s;
}
export function demo(){
 const s=initial('demonstracao@ouro.local'),month=today().slice(0,7);s.accounts[0].opening=42000000;s.accounts[1].opening=26550000;s.accounts.forEach(a=>a.date=month+'-01');
 const salaries=[250000,220000,280000,250000,300000,250000,220000];
 s.units.forEach((u,i)=>{const e={id:'e'+i,name:['Pedro Lima','Maria Souza','Bruno Costa','Alex Santos','Fernanda Souza','João Silva','Carlos Alves'][i],unit:u.id,role:'Comprador de ouro',salary:salaries[i],admission:'2025-01-01',active:true};s.employees.push(e);s.payroll.push({id:'p'+i,employee:e.id,unit:u.id,month,salary:e.salary,grams:i===6?null:[800000,450000,360000,320000,500000,600000][i],rate:1000,confirmed:i<3});['Aluguel','Energia','Internet'].forEach((n,j)=>s.bills.push({id:'b'+i+j,name:n,description:n+' • '+u.name,category:'c'+j,unit:u.id,amount:[700000,250000,40000][j]+i*12000,date:month+'-'+['05','15','20'][j],recurring:true}));});
 for(let i=0;i<7;i++){const b=s.bills[i*3];s.movements.push({id:'m'+i,account:'pay',amount:-b.amount,date:month+'-05',description:b.name,kind:'bill',bill:b.id,unit:b.unit,actor:'Ana Silva'});}
 return s;
}
