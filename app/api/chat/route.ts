import { eq } from 'drizzle-orm';
import { api, body, AppError } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/security/rate-limit';
import { chatInput } from '@/lib/validation';
import { prepareChat } from '@/lib/ai/chat-service';
import { streamChat } from '@/lib/ai/provider';
import { safeAIError } from '@/lib/ai/errors';
import { db } from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { serialized } from '@/lib/data';
import type { ChatEvent, Message } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 120;
export const POST = api(async request => {
  const user = await requireUser(); await rateLimit('chat', user.id, 20);
  const input = await body(request, chatInput);
  const controller = new AbortController(); const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(110000)]);
  const prepared = await prepareChat(user.id, input, signal);
  const encoder = new TextEncoder(); let connected = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      const send = (event: ChatEvent) => { if (connected) { try { output.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch { connected = false; controller.abort(); } } };
      let content = ''; let status: Message['status'] = 'complete'; let metadata = prepared.assistant.metadata;
      const start = Date.now(); let checkpoint = start;
      const heartbeat = setInterval(() => { if (connected) { try { output.enqueue(encoder.encode(': heartbeat\n\n')); } catch { connected = false; controller.abort(); } } }, 15000);
      send({ type: 'start', conversation: prepared.conversation, userMessage: prepared.userMessage, assistantMessage: prepared.assistant });
      send({ type: 'status', status: 'connecting' });
      if (prepared.trimmed) send({ type: 'warning', message: '컨텍스트 한도에 맞추어 오래된 메시지 일부를 이번 요청에서 제외했습니다. 대화 기록은 보존됩니다.' });
      try {
        for await (const chunk of streamChat(prepared.request)) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (chunk.type === 'text') {
            content += chunk.text; if (Buffer.byteLength(content, 'utf8') > 1000000) throw new AppError('OUTPUT_LIMIT', '응답 크기 한도에 도달했습니다.');
            send({ type: 'status', status: 'generating' }); send({ type: 'delta', text: chunk.text });
          } else if (chunk.type === 'thinking') send({ type: 'status', status: 'thinking' });
          else metadata = { ...metadata, ...chunk.usage };
          if (Date.now() - checkpoint > 1500) { await db().update(messages).set({ content, metadata }).where(eq(messages.id, prepared.assistant.id)); checkpoint = Date.now(); }
        }
        if (!content && !signal.aborted) throw new AppError('EMPTY_RESPONSE', 'Provider가 텍스트 응답을 반환하지 않았습니다.', 502);
      } catch (error) {
        const safe = safeAIError(error); status = signal.aborted ? 'stopped' : 'error';
        metadata = { ...metadata, error: signal.reason?.name === 'TimeoutError' ? '응답 시간이 초과되었습니다. 다시 생성할 수 있습니다.' : safe.message };
        if (status === 'error' || signal.reason?.name === 'TimeoutError') send({ type: 'error', message: metadata.error!, code: safe.code });
      } finally {
        clearInterval(heartbeat); controller.abort(); metadata = { ...metadata, latencyMs: Date.now() - start };
        try {
          const [saved] = await db().update(messages).set({ content, status, metadata }).where(eq(messages.id, prepared.assistant.id)).returning();
          if (saved) send({ type: 'done', message: serialized<Message>(saved) });
        } catch { send({ type: 'error', message: '답변을 저장하지 못했습니다. 내용을 복사한 후 연결을 확인해 주세요.', code: 'SAVE_FAILED' }); }
        if (connected) { connected = false; output.close(); }
      }
    },
    cancel() { connected = false; controller.abort(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
});
