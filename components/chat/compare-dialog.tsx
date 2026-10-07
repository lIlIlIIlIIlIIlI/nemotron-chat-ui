'use client';
import { useEffect, useRef, useState } from 'react';
import { Columns3, Square } from 'lucide-react';
import type { Workspace } from '@/hooks/use-workspace';
import type { ChatEvent } from '@/lib/types';
import { parseSSE } from '@/lib/ai/sse';
import { Dialog } from '../ui/dialog';
import { Markdown } from './markdown';
import { useFeedback } from '../ui/feedback';
type Comparison = { modelId: string; content: string; status: string; conversationId?: string };
export function CompareDialog({ workspace: w, onClose }: { workspace: Workspace; onClose(): void }) {
  const { toast } = useFeedback(); const models = w.data?.models.filter(x => x.isEnabled && w.data?.providers.some(p => p.id === x.providerId && p.isEnabled)) || [];
  const [selected, setSelected] = useState(models.slice(0,2).map(x => x.id)); const [prompt, setPrompt] = useState(''); const [results, setResults] = useState<Comparison[]>([]); const [busy, setBusy] = useState(false); const controllers = useRef<AbortController[]>([]);
  useEffect(() => () => controllers.current.forEach(x => x.abort()), []);
  async function run() {
    if (busy || selected.length < 2 || !prompt.trim()) return; setBusy(true); setResults(selected.map(modelId => ({ modelId, content: '', status: '연결 중' }))); controllers.current = [];
    await Promise.all(selected.map(async modelId => {
      const controller = new AbortController(); controllers.current.push(controller); const update = (patch: Partial<Comparison>) => setResults(old => old.map(x => x.modelId === modelId ? { ...x, ...patch } : x)); let text = '';
      try {
        const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelId, content: prompt, projectId: w.projectId, options: w.options, mode: w.mode, systemPrompt: w.systemPrompt }), signal: controller.signal });
        if (!response.ok) throw new Error((await response.json()).error || '요청 실패'); if (!response.body) throw new Error('응답 없음');
        for await (const frame of parseSSE(response.body)) { const event = JSON.parse(frame.data) as ChatEvent; if (event.type === 'start') update({ conversationId: event.conversation.id }); if (event.type === 'delta') { text += event.text; update({ content: text, status: '생성 중' }); } if (event.type === 'done') update({ content: event.message.content, status: event.message.status === 'complete' ? '완료' : '중단됨' }); if (event.type === 'error') update({ status: event.message }); }
      } catch (error) { update({ status: controller.signal.aborted ? '중단됨' : (error as Error).message }); }
    })); controllers.current = []; setBusy(false); await w.refreshList().catch(error => toast(error.message,true));
  }
  return <Dialog open onClose={onClose} title="모델 비교" className="compare-dialog"><div className="dialog-body"><p className="muted">같은 질문을 2~4개 모델에 각각 전송합니다. 모델 수만큼 API 비용이 발생하며 결과는 별도 대화로 저장됩니다.</p><div className="compare-models">{models.map(model => <label className="check-row" key={model.id}><input type="checkbox" disabled={busy || !selected.includes(model.id) && selected.length >= 4} checked={selected.includes(model.id)} onChange={e => setSelected(old => e.target.checked ? [...old,model.id] : old.filter(x => x !== model.id))} />{model.displayName}</label>)}</div>{models.length < 2 && <p className="empty-state">먼저 모델을 2개 이상 등록해 주세요.</p>}<textarea aria-label="모델 비교 질문" rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="모든 모델에게 물어볼 질문" disabled={busy} /><div className="form-actions">{busy ? <button className="button" onClick={() => controllers.current.forEach(x => x.abort())}><Square size={14} />모두 중단</button> : <button className="button primary" disabled={selected.length < 2 || !prompt.trim()} onClick={() => void run()}><Columns3 size={16} />{selected.length}개 모델로 비교</button>}</div><div className="compare-columns">{results.map(result => <section className="compare-column" key={result.modelId}><h3>{models.find(x => x.id === result.modelId)?.displayName}</h3><small role="status">{result.status}</small><Markdown content={result.content} />{result.conversationId && !busy && <button className="button" onClick={() => { void w.openConversation(result.conversationId!); onClose(); }}>대화 이어가기</button>}</section>)}</div></div></Dialog>;
}
