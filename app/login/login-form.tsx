'use client';
import { FormEvent, useState } from 'react';
import { LockKeyhole, ArrowRight, ShieldCheck } from 'lucide-react';
export default function LoginForm() {
  const [setup, setSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const res = await fetch(setup ? '/api/auth/bootstrap' : '/api/auth/login', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, password, ...(setup ? {name,secret} : {}) }),
        credentials:'same-origin', cache:'no-store'
      });
      const data = await res.json() as {error?:string};
      if (!res.ok) throw Error(data.error || 'Não foi possível entrar.');
      window.location.replace('/');
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha de autenticação.'); setBusy(false); }
  }
  return <main className="login-screen">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-emblem"><LockKeyhole size={26} strokeWidth={1.5}/></div>
      <div className="login-overline">OURO CERTO</div>
      <h1 id="login-title">{setup ? 'Primeiro acesso' : 'Gestão Financeira'}</h1>
      <p className="login-description">{setup ? 'Cadastre o primeiro administrador autorizado.' : 'Acesso exclusivo para Administrador e Financeiro.'}</p>
      <form onSubmit={submit} className="login-fields">
        {setup && <><label htmlFor="login-name">Nome do administrador</label><input id="login-name" type="text" autoComplete="name" required value={name} onChange={e=>setName(e.target.value)}/></>}
        <label htmlFor="login-email">E-mail</label>
        <input id="login-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>
        <label htmlFor="login-password">Senha</label>
        <input id="login-password" type="password" autoComplete={setup?'new-password':'current-password'} minLength={setup?12:undefined} required value={password} onChange={e=>setPassword(e.target.value)}/>
        {setup && <><label htmlFor="login-secret">Segredo de instalação</label><input id="login-secret" type="password" autoComplete="off" required value={secret} onChange={e=>setSecret(e.target.value)}/></>}
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-submit" type="submit" disabled={busy}>{busy?'Verificando...':setup?'Criar administrador':'Entrar'}<ArrowRight size={17}/></button>
      </form>
      <button className="login-setup" type="button" onClick={()=>{setSetup(!setup);setError('');}}>{setup?'Voltar ao login':'Configurar primeiro acesso'}</button>
      <div className="login-footer"><ShieldCheck size={14}/> Área restrita. Seus dados financeiros exigem autenticação.</div>
    </section>
  </main>;
}
