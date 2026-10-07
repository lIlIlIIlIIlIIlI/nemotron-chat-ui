import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';
export default async function LoginPage() { if (await getUser()) redirect('/'); return <LoginForm />; }
