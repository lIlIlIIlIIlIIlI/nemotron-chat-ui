import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { sharedConversations } from '@/lib/db/schema';
import { Markdown } from '@/components/chat/markdown';
export const dynamic = 'force-dynamic';
export const metadata = { title: '공유된 대화 · Nemotron', robots: { index: false, follow: false } };
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  const [shared] = await db().select({ title: sharedConversations.title, snapshot: sharedConversations.snapshot }).from(sharedConversations).where(eq(sharedConversations.id, token)); if (!shared) notFound();
  return <main className="shared-page"><header><a href="/">nemo workspace</a><span>읽기 전용 공유 대화</span></header><h1>{shared.title}</h1>{shared.snapshot.map((message,index) => <article key={index} className={`message ${message.role}`}><strong>{message.role === 'user' ? '사용자' : 'Assistant'}</strong><Markdown content={message.content} /></article>)}<p className="fine-print">작성자가 공개한 대화 사본입니다. AI 답변의 정확성을 확인하세요.</p></main>;
}
