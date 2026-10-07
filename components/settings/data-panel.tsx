'use client';
import { useEffect, useState } from 'react';
import type { Workspace } from '@/hooks/use-workspace';
import type { Conversation } from '@/lib/types';
import { apiFetch } from '@/lib/client';
import { useFeedback } from '../ui/feedback';
export function DataPanel({ workspace: w }: { workspace: Workspace }) {
  const { toast, confirm } = useFeedback(); const [archived, setArchived] = useState<Conversation[]>([]); const [offset, setOffset] = useState(0); const [more, setMore] = useState(false);
  useEffect(() => { apiFetch<{ items: Conversation[]; hasMore: boolean }>(`/api/conversations?archived=true&offset=${offset}`).then(result => { setArchived(old => offset ? [...old, ...result.items] : result.items); setMore(result.hasMore); }).catch(error => toast(error.message, true)); }, [offset, toast]);
  async function remove(target: string) {
    if (!await confirm(`${target === 'chats' ? '모든 대화' : target === 'projects' ? '모든 프로젝트와 프로젝트 파일' : target === 'files' ? '모든 업로드 파일' : '저장된 모든 API Key'}를 영구 삭제할까요?`)) return;
    try { await apiFetch(target === 'chats' ? '/api/conversations' : '/api/settings/data', { method: 'DELETE', body: JSON.stringify(target === 'chats' ? { confirmation: 'DELETE_ALL_CHATS' } : { target, confirmation: 'DELETE' }) }); await w.loadData(); await w.refreshList(); if (target === 'chats') { w.newChat(); setArchived([]); } toast('삭제했습니다.'); } catch (error) { toast((error as Error).message, true); }
  }
  return <section className="settings-section"><h3>Data Controls</h3><h4>보관된 대화</h4>{!archived.length && <p className="muted">보관한 대화가 없습니다.</p>}{archived.map(item => <div className="settings-list-row" key={item.id}><span className="grow">{item.title}</span><button className="button small" onClick={async () => { try { await w.patchConversation(item.id, { isArchived: false }); setArchived(old => old.filter(x => x.id !== item.id)); } catch (error) { toast((error as Error).message, true); } }}>복원</button></div>)}{more && <button className="button" onClick={() => setOffset(x => x + 40)}>더 보기</button>}<hr /><h4>데이터 삭제</h4>{[['chats','모든 대화 삭제'],['projects','모든 프로젝트 삭제'],['files','모든 업로드 파일 삭제'],['credentials','저장된 모든 API Key 삭제']].map(([target,label]) => <div className="settings-list-row" key={target}><span className="grow">{label}</span><button className="button danger small" onClick={() => void remove(target)}>삭제</button></div>)}<p className="fine-print">대화 내보내기는 대화 상단 메뉴에서 Markdown / JSON / Text로 제공합니다.</p></section>;
}
type UsageRow = { model: string | null; responses: number; promptTokens: number; completionTokens: number; latencyMs: number };
export function UsagePanel() {
  const { toast } = useFeedback(); const [rows, setRows] = useState<UsageRow[] | null>(null);
  useEffect(() => { apiFetch<UsageRow[]>('/api/usage').then(setRows).catch(error => toast(error.message, true)); }, [toast]);
  return <section className="settings-section"><h3>Usage</h3><p className="muted">Provider가 반환한 토큰 수만 집계합니다. 누락된 수치는 0으로 표시되며 청구 금액은 Provider에서 확인하세요.</p>{rows === null ? <div className="skeleton" /> : !rows.length ? <p>아직 사용 기록이 없습니다.</p> : <div className="table-scroll"><table><thead><tr><th>모델</th><th>응답</th><th>입력 토큰</th><th>출력 토큰</th><th>평균 시간</th></tr></thead><tbody>{rows.map((row,index) => <tr key={index}><td>{row.model || '삭제된 모델'}</td><td>{row.responses}</td><td>{row.promptTokens.toLocaleString()}</td><td>{row.completionTokens.toLocaleString()}</td><td>{(row.latencyMs / 1000).toFixed(1)}s</td></tr>)}</tbody></table></div>}</section>;
}
