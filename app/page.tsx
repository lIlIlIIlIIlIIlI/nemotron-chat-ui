import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { ChatApp } from '@/components/chat-app';
export default async function Home() { if (!await getUser()) redirect('/login'); return <ChatApp />; }
