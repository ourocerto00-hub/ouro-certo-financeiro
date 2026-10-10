import { redirect } from 'next/navigation';
import { currentUser } from '../auth';
import LoginForm from './login-form';
export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect('/');
  return <LoginForm />;
}
