import { eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { api, body, AppError } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/security/rate-limit';
import { chatInput } from '@/lib/validation';
import { prepareChat } from '@/lib/ai/chat-service';
import { streamChat } from '@/lib/ai/provider';
import { safeAIError } from '@/lib/ai/errors';
import { db } from '@/lib/db';
import { messages, attachments, attachmentChunks } from '@/lib/db/schema';
import { fileChunks } from '@/lib/db/files';
import { wantsImage } from '@/lib/ai/image-intent';
import { serialized } from '@/lib/data';
import type { ChatEvent, Message } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 120;
export const POST = api(async request => {
  const user = await requireUser(); await rateLimit('chat', user.id, 20);
  const input = await body(request, chatInput);
  const imageMode = Boolean(!input.attachmentIds.length && wantsImage(input.content || '') && !input.regenerateId);
  const controller = new AbortController(); const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(110000)]);
  if (imageMode) await rateLimit('image-generation', user.id, 5, 60);
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
        if (imageMode) {
          send({ type: 'status', status: 'generating' });
          const baseValue = process.env.FLUX_WORKER_URL;
          const key = process.env.FLUX_WORKER_API_KEY;
          if (!baseValue || !key) throw new AppError('CONFIGURATION', '이미지 생성 Worker 환경 변수를 설정해 주세요.', 503);
          let base: URL;
          try { base = new URL(baseValue); } catch { throw new AppError('CONFIGURATION', 'Worker URL 형식이 올바르지 않습니다.', 503); }
          if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new AppError('CONFIGURATION', 'Worker HTTPS 기본 URL을 설정해 주세요.', 503);
          const response = await fetch(new URL('/api/generate', base), { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: input.content, width: 1024, height: 1024, response_format: 'json' }), signal, cache: 'no-store' });
          if (!response.ok) throw new AppError('IMAGE_FAILED', '이미지를 생성하지 못했습니다. Worker 로그를 확인해 주세요.', 502);
          const imageResult: unknown = await response.json();
          if (!imageResult || typeof imageResult !== 'object' || !('image' in imageResult) || typeof imageResult.image !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(imageResult.image)) throw new AppError('IMAGE_INVALID', 'Worker 이미지 응답이 올바르지 않습니다.', 502);
          const bytes = Buffer.from(imageResult.image, 'base64');
          if (!bytes.length || bytes.length > 8 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new AppError('IMAGE_INVALID', 'PNG 이미지 크기 또는 형식이 올바르지 않습니다.', 502);
          signal.throwIfAborted();
          const fileId = crypto.randomUUID();
          await db().batch([
            db().insert(attachments).values({ id: fileId, userId: user.id, name: `flux-${fileId}.png`, mimeType: 'image/png', size: bytes.length, conversationId: prepared.conversation.id, messageId: prepared.assistant.id }),
            ...fileChunks(fileId, bytes).map(chunk => db().insert(attachmentChunks).values(chunk)),
          ] as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
          metadata = { ...metadata, generatedImageId: fileId };
          content = '생성된 이미지';
        } else for await (const chunk of streamChat(prepared.request)) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (chunk.type === 'text') {
            content += chunk.text; if (Buffer.byteLength(content, 'utf8') > 1000000) throw new AppError('OUTPUT_LIMIT', '응답 크기 한도에 도달했습니다.');
            send({ type: 'status', status: 'generating' }); send({ type: 'delta', text: chunk.text });
          } else if (chunk.type === 'thinking') send({ type: 'status', status: 'thinking' });
          else metadata = { ...metadata, ...chunk.usage };
          if (Date.now() - checkpoint > 1500) { await db().update(messages).set({ content, metadata }).where(eq(messages.id, prepared.assistant.id)); checkpoint = Date.now(); }
        }
        signal.throwIfAborted();
        if (!content) throw new AppError('EMPTY_RESPONSE', 'Provider가 텍스트 응답을 반환하지 않았습니다.', 502);
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
