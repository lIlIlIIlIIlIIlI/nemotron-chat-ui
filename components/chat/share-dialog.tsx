'use client';
import { useEffect, useState } from 'react';
import { Copy, Link, LockKeyhole } from 'lucide-react';
import { apiFetch, copyText } from '@/lib/client';
import { Dialog } from '../ui/dialog';
import { useFeedback } from '../ui/feedback';
export function ShareDialog({ conversationId, onClose }: { conversationId: string; onClose(): void }) {
  const { toast, confirm } = useFeedback(); const [token, setToken] = useState<string | null>(null); const [busy, setBusy] = useState(true);
  useEffect(() => { apiFetch<{ id: string | null }>(`/api/conversations/${conversationId}/share`).then(value => setToken(value.id)).catch(error => toast(error.message, true)).finally(() => setBusy(false)); }, [conversationId, toast]);
  const url = token ? `${window.location.origin}/share/${token}` : '';
  async function share() { if (!await confirm('현재 분기의 질문과 답변을 링크를 가진 누구나 읽을 수 있게 공개할까요? 대화 본문에 민감한 내용이 없는지 확인해 주세요.')) return; setBusy(true); try { const value = await apiFetch<{ id: string }>(`/api/conversations/${conversationId}/share`, { method: 'POST', body: '{}' }); setToken(value.id); } catch (error) { toast((error as Error).message, true); } finally { setBusy(false); } }
  return <Dialog open onClose={onClose} title="대화 공유"><div className="dialog-body form-stack"><LockKeyhole size={27} /><p>명시적으로 공개한 대화만 공유됩니다. API Key, 시스템 지침, 첨부 파일은 포함되지 않습니다. 질문·답변에 직접 적힌 개인정보는 공유됩니다.</p>{token && <div className="share-url"><input aria-label="공유 URL" readOnly value={url} /><button className="icon-button" aria-label="공유 링크 복사" onClick={() => void copyText(url).then(() => toast('링크를 복사했습니다.')).catch(() => toast('복사 권한을 확인해 주세요.',true))}><Copy size={17} /></button></div>}<button className="button primary" disabled={busy} onClick={() => void share()}><Link size={16} />{token ? '현재 대화로 공유 내용 갱신' : '공개 링크 만들기'}</button>{token && <button className="button danger" disabled={busy} onClick={async () => { try { await apiFetch(`/api/conversations/${conversationId}/share`, { method: 'DELETE' }); setToken(null); toast('공유를 해제했습니다.'); } catch (error) { toast((error as Error).message, true); } }}>공유 해제</button>}</div></Dialog>;
}
