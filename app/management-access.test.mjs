import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccessManagement,visibleState,isManagementOperation} from './management-access.mjs';
const email='owner@example.invalid';
test('apenas administrador da identidade configurada recebe permissão',()=>{
 assert.equal(canAccessManagement({email,role:'admin'},email),true);
 assert.equal(canAccessManagement({email:email.toUpperCase(),role:'admin'},' '+email+' '),true);
 for(const user of [null,{email,role:'financeiro'},{email:'other@example.invalid',role:'admin',displayName:'André Victor'}])assert.equal(canAccessManagement(user,email),false);
 assert.equal(canAccessManagement({email,role:'admin'},undefined),false);
 assert.equal(canAccessManagement({email,role:'admin'},''),false);
});
test('oculta campos reservados sem modificar os dados persistidos ou módulos existentes',()=>{
 const s={bills:[{id:'b'}],movements:[],managementMonths:[{gross:120000}],managementAccumulated:{grams:1000}},before=structuredClone(s);
 assert.deepEqual(visibleState(s,false),{bills:[{id:'b'}],movements:[]});
 assert.equal(visibleState(s,true),s);assert.equal(visibleState(null,false),null);assert.deepEqual(s,before);
});
test('todas as operações de Fecha Real são identificadas, inclusive novas operações',()=>{
 for(const op of ['managementPartial','managementClose','managementReopen','managementEditPartial','managementDeletePartial','managementAccumulated','managementEditAccumulated','managementDeleteAccumulated','managementFutureOperation'])assert.equal(isManagementOperation(op),true);
 for(const op of ['period','advance','movement',null,123])assert.equal(isManagementOperation(op),false);
});
