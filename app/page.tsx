import { redirect } from 'next/navigation';
import { currentUser } from './auth';
import Finance from './finance';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <Finance />;
}
