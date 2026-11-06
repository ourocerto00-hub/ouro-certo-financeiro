import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply,cents,balance,summary,salaryDue,remuneration,billPaid,today,earnsCommission,commissionReady,payrollNeedsSync} from './engine.mjs';
const d=today(),month=d.slice(0,7),actor='test@example.com';
const act=(s,op,v)=>apply(s,op,v,actor);
function fixture(){let s=initial(actor);s.accounts.forEach(a=>{a.date='2020-01-01';a.opening=10000000;});s=act(s,'employee',{name:'Alex',role:'Comprador',unit:'u3',salary:'2500',admission:'2020-01-01',month});return s;}
test('precisão monetária em centavos e formato brasileiro',()=>{assert.equal(cents('1.234,56'),123456);assert.equal(cents('0.29'),29);assert.throws(()=>cents('1.001'));assert.throws(()=>cents('-1'));});
test('despesa reduz caixa, atribui unidade e não duplica custo',()=>{let s=fixture();s=act(s,'movement',{account:'pay',direction:'out',date:d,amount:'350',description:'Combustível',unit:'u4',category:'c4'});assert.equal(balance(s,'pay'),9965000);assert.equal(summary(s,month,'u4').total,35000);assert.equal(summary(s,month,'u4').paid,35000);assert.equal(summary(s,month,'u0').pay,9965000);assert.throws(()=>act(s,'movement',{account:'pay',direction:'out',date:d,amount:'50',description:'Sem unidade',category:'c1'}));});
test('vale e comissão preservam custo bruto e saldo líquido',()=>{let s=fixture(),p=s.payroll[0];s=act(s,'grams',{id:p.id,grams:'600'});s=act(s,'advance',{employee:p.employee,month,date:d,amount:'500',description:'Vale',account:'pay'});p=s.payroll[0];assert.equal(remuneration(p),850000);assert.equal(salaryDue(s,p),800000);assert.equal(summary(s,month,'u3').total,850000);s=act(s,'confirmSalary',{id:p.id});s=act(s,'paySalary',{id:p.id,amount:'8000',date:d,account:'pay'});assert.equal(salaryDue(s,s.payroll[0]),0);assert.equal(balance(s,'pay'),9150000);assert.throws(()=>act(s,'paySalary',{id:p.id,amount:'1',date:d,account:'pay'}));});
test('comissão ausente é diferente de zero confirmado',()=>{let s=fixture();assert.equal(s.payroll[0].grams,null);assert.throws(()=>act(s,'confirmSalary',{id:s.payroll[0].id}));s=act(s,'grams',{id:s.payroll[0].id,grams:'0'});s=act(s,'confirmSalary',{id:s.payroll[0].id});assert.equal(s.payroll[0].confirmed,true);});
test('pagamentos parciais, duplicados e cancelamentos',()=>{let s=fixture();s=act(s,'bill',{name:'Aluguel',date:d,amount:'1000',unit:'u0',category:'c0'});const b=s.bills[0];s=act(s,'paybill',{id:b.id,date:d,amount:'400',account:'pay'});assert.equal(billPaid(s,b),40000);assert.throws(()=>act(s,'paybill',{id:b.id,date:d,amount:'700',account:'pay'}));s=act(s,'cancel',{table:'movements',id:s.movements[0].id,reason:'Pagamento estornado'});assert.equal(billPaid(s,b),0);assert.equal(balance(s,'pay'),10000000);assert.equal(s.movements.length,1);});
test('transferências não geram custo e cancelam as duas pontas',()=>{let s=fixture();s=act(s,'transfer',{date:d,account:'gold',destination:'pay',amount:'2000',description:'Abastecimento'});assert.equal(balance(s,'gold'),9800000);assert.equal(balance(s,'pay'),10200000);assert.equal(summary(s,month).total,250000);s=act(s,'cancel',{table:'movements',id:s.movements[0].id,reason:'Reversão'});assert.equal(balance(s,'gold'),10000000);assert.equal(balance(s,'pay'),10000000);});
test('fechamento exige justificativa e bloqueia lançamentos retroativos',()=>{let s=fixture();assert.throws(()=>act(s,'close',{date:d,account:'pay',real:'99900'}));s=act(s,'close',{date:d,account:'pay',real:'99900',reason:'Conciliação pendente'});assert.equal(s.closings[0].difference,-10000);assert.throws(()=>act(s,'movement',{date:d,account:'pay',direction:'in',amount:'1',description:'Entrada',origin:'Aporte'}));s=act(s,'reopen',{id:s.closings[0].id,reason:'Conferência corrigida'});s=act(s,'movement',{date:d,account:'pay',direction:'in',amount:'1',description:'Entrada',origin:'Aporte'});assert.equal(balance(s,'pay'),10000100);});
test('recorrências idempotentes e preservação da taxa histórica',()=>{let s=fixture();s=act(s,'bill',{name:'Internet',date:'2025-01-31',amount:'400',unit:'u0',category:'c2',recurring:true});s=act(s,'period',{month:'2025-02'});s=act(s,'period',{month:'2025-02'});assert.equal(s.bills.filter(b=>b.date==='2025-02-28').length,1);s=act(s,'rate',{month:'2099-01',value:'20'});s=act(s,'period',{month:'2099-01'});assert.equal(s.payroll.find(p=>p.month===month).rate,1000);assert.equal(s.payroll.find(p=>p.month==='2099-01').rate,2000);});

test('vales podem ultrapassar salário e não impedem ajuste de comissão',()=>{let s=fixture(),p=s.payroll[0];s=act(s,'advance',{employee:p.employee,month,date:d,amount:'5000',description:'Vale extraordinário',account:'pay'});assert.equal(s.advances[0].amount,500000);assert.equal(salaryDue(s,s.payroll[0]),0);assert.equal(balance(s,'pay'),9500000);s=act(s,'grams',{id:p.id,grams:'0'});assert.equal(remuneration(s.payroll[0]),250000);assert.equal(summary(s,month,'u3').total,250000);s=act(s,'confirmSalary',{id:p.id});assert.equal(s.payroll[0].confirmed,true);});

test('marketing com salário fixo não precisa informar gramas para receber',()=>{
 let s=act(initial(actor),'employee',{name:'Marketing',role:'Marketing',unit:'u0',salary:'3200',compensationType:'fixed',admission:'2020-01-01',month});
 const p=s.payroll[0];assert.equal(earnsCommission(p),false);assert.equal(commissionReady(p),true);assert.equal(remuneration(p),320000);
 assert.throws(()=>act(s,'grams',{id:p.id,grams:'10'}),/somente salário fixo/);
 s=act(s,'confirmSalary',{id:p.id});assert.equal(s.payroll[0].confirmed,true);
 s=act(s,'paySalary',{id:p.id,amount:'3200',date:d,account:'pay'});assert.equal(salaryDue(s,s.payroll[0]),0);
});

test('comprador pode receber fixo mais gramas ou somente gramas, independentemente do cargo',()=>{
 let s=fixture(),p=s.payroll[0];assert.equal(earnsCommission(p),true);
 s=act(s,'employee',{id:p.employee,name:'Alex',role:'Gerente',unit:'u3',salary:'9999',compensationType:'grams_only',admission:'2020-01-01',month});
 p=s.payroll[0];assert.equal(p.salary,0);assert.equal(p.compensationType,'grams_only');assert.equal(remuneration(p),0);
 assert.throws(()=>act(s,'confirmSalary',{id:p.id}),/Informe as gramas/);
 s=act(s,'grams',{id:p.id,grams:'25.5'});assert.equal(remuneration(s.payroll[0]),25500);
 s=act(s,'confirmSalary',{id:p.id});assert.equal(salaryDue(s,s.payroll[0]),25500);
});

test('edição atualiza apenas folhas abertas e não reescreve períodos históricos ou pagos',()=>{
 let s=fixture();const id=s.employees[0].id,previous='2025-10';
 s=act(s,'period',{month:previous});const old=s.payroll.find(p=>p.month===previous);
 s=act(s,'grams',{id:old.id,grams:'0'});s=act(s,'confirmSalary',{id:old.id});
 s=act(s,'paySalary',{id:old.id,date:'2025-10-10',account:'pay',amount:'2500'});
 s=act(s,'grams',{id:s.payroll.find(p=>p.month===month).id,grams:'3'});
 s=act(s,'confirmSalary',{id:s.payroll.find(p=>p.month===month).id});
 s=act(s,'paySalary',{id:s.payroll.find(p=>p.month===month).id,date:d,account:'pay',amount:'2530'});
 s=act(s,'employee',{id,name:'Alex',role:'Comprador',unit:'u3',salary:'4500',compensationType:'fixed',admission:'2020-01-01',month});
 assert.equal(s.payroll.find(p=>p.month===previous).salary,old.salary);
 assert.equal(s.payroll.find(p=>p.month===month).salary,250000);
 assert.equal(s.payroll.find(p=>p.month===month).compensationType,'fixed_plus_grams');
 assert.equal(s.employees[0].salary,450000);
 s=act(s,'period',{month:'2099-01'});const next=s.payroll.find(p=>p.month==='2099-01');
 assert.equal(next.salary,450000);assert.equal(next.compensationType,'fixed');
});

test('edição de funcionário em folha aberta aplica salário e modalidade no mês atual',()=>{
 let s=fixture(),p=s.payroll[0];s=act(s,'employee',{id:p.employee,name:'Alex',role:'Marketing',unit:'u3',salary:'3000',compensationType:'fixed',admission:'2020-01-01',month});
 p=s.payroll[0];assert.equal(p.salary,300000);assert.equal(p.compensationType,'fixed');assert.equal(remuneration(p),300000);assert.equal(commissionReady(p),true);
});

test('mudar para salário fixo retira gramas até de folha já conferida e ainda não paga',()=>{
 let s=fixture(),p=s.payroll[0];s=act(s,'grams',{id:p.id,grams:'150'});s=act(s,'confirmSalary',{id:p.id});
 s=act(s,'employee',{id:p.employee,name:'Alex',role:'Comprador',unit:'u3',salary:'2500',compensationType:'fixed',admission:'2020-01-01',month});
 p=s.payroll[0];assert.equal(p.grams,null);assert.equal(p.compensationType,'fixed');assert.equal(p.confirmed,false);
 assert.equal(remuneration(p),250000);assert.equal(salaryDue(s,p),250000);
 assert.throws(()=>act(s,'grams',{id:p.id,grams:'10'}),/somente salário fixo/);
});

test('preparar competência corrige automaticamente folha antiga que ficou com gramas',()=>{
 let s=fixture(),p=s.payroll[0];s=act(s,'grams',{id:p.id,grams:'120'});s=act(s,'confirmSalary',{id:p.id});
 // Simula o defeito da versão anterior: o cadastro foi atualizado, mas a folha não.
 s.employees[0].compensationType='fixed';
 assert.equal(payrollNeedsSync(s,month),true);
 s=act(s,'period',{month});p=s.payroll[0];
 assert.equal(p.compensationType,'fixed');assert.equal(p.grams,null);assert.equal(p.confirmed,false);
 assert.equal(remuneration(p),250000);assert.equal(payrollNeedsSync(s,month),false);
});

test('folha de competência anterior também perde gramas se ainda não foi paga',()=>{
 let s=fixture(),historical='2026-10';s=act(s,'period',{month:historical});
 const p=s.payroll.find(p=>p.month===historical);
 s=act(s,'grams',{id:p.id,grams:'1066'});s=act(s,'confirmSalary',{id:p.id});
 // O cadastro do Alef foi mudado para fixo, mas a folha de outubro ficou antiga.
 s.employees[0].compensationType='fixed';
 assert.equal(payrollNeedsSync(s,historical),true);
 s=act(s,'period',{month:historical});const synced=s.payroll.find(x=>x.id===p.id);
 assert.equal(synced.compensationType,'fixed');assert.equal(synced.grams,null);
 assert.equal(synced.confirmed,false);assert.equal(remuneration(synced),250000);
 assert.equal(payrollNeedsSync(s,historical),false);
});
