'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { parseSSE } from '@/lib/ai/sse';
import type { AIModel, Attachment, Bootstrap, ChatEvent, Conversation, GenerationOptions, Message } from '@/lib/types';
import { useFeedback } from '@/components/ui/feedback';
export function useWorkspace() {
  const { toast } = useFeedback();
  const [data, setData] = useState<Bootstrap | null>(null); const [error, setError] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]); const [hasMore, setHasMore] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null); const [messages, setMessages] = useState<Message[]>([]); const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingChat, setLoadingChat] = useState(false); const [busy, setBusy] = useState(false); const [status, setStatus] = useState('');
  const [modelId, setModelId] = useState(''); const [projectId, setProjectId] = useState<string | null>(null); const [mode, setMode] = useState<'chat' | 'code'>('chat');
  const [options, setOptions] = useState<GenerationOptions>({}); const [systemPrompt, setSystemPrompt] = useState('');
  const abort = useRef<AbortController | null>(null); const nav = useRef(0); const active = useRef<string | null>(null);
  const loadData = useCallback(async () => {
    const boot = await apiFetch<Bootstrap>('/api/bootstrap'); setData(boot);
    setModelId(current => boot.models.some(x => x.id === current && x.isEnabled) ? current : boot.models.find(x => x.isEnabled)?.id || ''); return boot;
  }, []);
  const refreshList = useCallback(async (offset = 0) => {
    const result = await apiFetch<{ items: Conversation[]; hasMore: boolean }>(`/api/conversations?offset=${offset}`);
    setConversations(old => offset ? [...old, ...result.items.filter(x => !old.some(y => y.id === x.id))] : result.items); setHasMore(result.hasMore);
  }, []);
  const openConversation = useCallback(async (id: string) => {
    abort.current?.abort(); const sequence = ++nav.current; setLoadingChat(true);
    try {
      const result = await apiFetch<{ conversation: Conversation; messages: Message[]; attachments: Attachment[] }>(`/api/conversations/${id}`); if (sequence !== nav.current) return;
      active.current = id; setConversation(result.conversation); setMessages(result.messages); setAttachments(result.attachments); setProjectId(result.conversation.projectId); setSystemPrompt(result.conversation.systemPrompt);
      if (result.conversation.defaultModelId) setModelId(result.conversation.defaultModelId); window.history.replaceState({}, '', `/?chat=${id}`);
    } catch (err) { toast((err as Error).message, true); } finally { if (sequence === nav.current) setLoadingChat(false); }
  }, [toast]);
  const newChat = useCallback((project: string | null = null) => {
    abort.current?.abort(); ++nav.current; active.current = null; setConversation(null); setMessages([]); setAttachments([]); setProjectId(project); setSystemPrompt(''); setLoadingChat(false); window.history.replaceState({}, '', '/');
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiFetch<Bootstrap>('/api/bootstrap', { signal: controller.signal }),
      apiFetch<{ items: Conversation[]; hasMore: boolean }>('/api/conversations?offset=0', { signal: controller.signal }),
    ]).then(([boot, list]) => {
      if (controller.signal.aborted) return;
      setData(boot); setConversations(list.items); setHasMore(list.hasMore);
      setOptions(boot.settings.options); setProjectId(boot.settings.defaultProjectId);
      const preferred = boot.models.find(x => x.id === boot.settings.defaultModelId && x.isEnabled);
      setModelId(preferred?.id || boot.models.find(x => x.isEnabled)?.id || '');
      const id = new URLSearchParams(window.location.search).get('chat'); if (id) void openConversation(id);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => { controller.abort(); abort.current?.abort(); };
  }, [openConversation]);

  const patchConversation = useCallback(async (id: string, patch: Partial<Conversation>) => {
    const updated = await apiFetch<Conversation>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (active.current === id) setConversation(updated); await refreshList(); return updated;
  }, [refreshList]);
  async function send(input: { content?: string; files?: Attachment[]; regenerateId?: string; parentMessageId?: string | null; selectedModelId?: string }) {
    if (abort.current || loadingChat) return false;
    const selected = input.selectedModelId || modelId;
    if (!selected) { toast('설정에서 Provider와 모델을 먼저 추가해 주세요.', true); return false; }
    const controller = new AbortController(); const sequence = nav.current; abort.current = controller; setBusy(true); setStatus('connecting');
    let assistantId = ''; let fullText = ''; let frame = 0; let accepted = false; let finalized = false;
    const flush = () => { if (assistantId && sequence === nav.current) setMessages(old => old.map(x => x.id === assistantId ? { ...x, content: fullText } : x)); frame = 0; };
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: active.current || undefined, projectId, modelId: selected, content: input.content, attachmentIds: input.files?.map(x => x.id) || [], regenerateId: input.regenerateId, parentMessageId: input.parentMessageId, mode, options, systemPrompt }), signal: controller.signal });
      if (!response.ok) throw new Error((await response.json()).error || '채팅 요청에 실패했습니다.');
      if (!response.body) throw new Error('스트리밍 연결을 열지 못했습니다.');
      for await (const item of parseSSE(response.body)) {
        if (controller.signal.aborted || sequence !== nav.current) break;
        const event = JSON.parse(item.data) as ChatEvent;
        if (event.type === 'start') {
          accepted = true; active.current = event.conversation.id; setConversation(event.conversation); assistantId = event.assistantMessage.id;
          setMessages(old => [...old, ...(event.userMessage ? [event.userMessage] : []), event.assistantMessage]);
          if (input.files) setAttachments(old => [...old, ...input.files!.filter(x => !old.some(y => y.id === x.id)).map(x => ({ ...x, messageId: event.userMessage?.id || null }))]);
          window.history.replaceState({}, '', `/?chat=${event.conversation.id}`); void refreshList().catch(() => {});
        }
        if (event.type === 'delta') { fullText += event.text; if (!frame) frame = requestAnimationFrame(flush); }
        if (event.type === 'status') setStatus(event.status);
        if (event.type === 'warning') toast(event.message);
        if (event.type === 'error') toast(event.message, true);
        if (event.type === 'done') { finalized = true; cancelAnimationFrame(frame); frame = 0; setMessages(old => old.map(x => x.id === event.message.id ? event.message : x)); }
      }
    } catch (err) {
      cancelAnimationFrame(frame); flush();
      if (!controller.signal.aborted) toast((err as Error).message, true);
      if (sequence === nav.current) setMessages(old => old.map(x => x.id === assistantId ? { ...x, status: controller.signal.aborted ? 'stopped' : 'error' } : x));
    } finally {
      cancelAnimationFrame(frame);
      if (!finalized) {
        flush();
        // Aborting a reader may end iteration normally instead of throwing.
        if (controller.signal.aborted && sequence === nav.current) setMessages(old => old.map(x => x.id === assistantId ? { ...x, status: 'stopped' } : x));
      }
      if (abort.current === controller) { abort.current = null; setBusy(false); setStatus(''); } void refreshList().catch(() => {});
    }
    return accepted;
  }
  const stop = useCallback(() => abort.current?.abort(), []);
  const favorite = async (model: AIModel) => { await apiFetch(`/api/models/${model.id}`, { method: 'PATCH', body: JSON.stringify({ isFavorite: !model.isFavorite }) }); await loadData(); };
  return { data, setData, error, conversations, hasMore, conversation, messages, setMessages, attachments, loadingChat, busy, status, modelId, setModelId, projectId, setProjectId, mode, setMode, options, setOptions, systemPrompt, setSystemPrompt, loadData, refreshList, openConversation, newChat, patchConversation, send, stop, favorite };
}
export type Workspace = ReturnType<typeof useWorkspace>;
