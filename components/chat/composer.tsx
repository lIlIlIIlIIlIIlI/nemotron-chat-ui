'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Code2, File, ImagePlus, Loader2, Paperclip, Plus, SlidersHorizontal, Square, X } from 'lucide-react';
import type { Attachment, Message } from '@/lib/types';
import type { Workspace } from '@/hooks/use-workspace';
import { apiFetch } from '@/lib/client';
import { useFeedback } from '../ui/feedback';
import { Dialog } from '../ui/dialog';
import { ModelSelector } from './model-selector';
export function Composer({ workspace: w, value, setValue, editing, clearEdit, onSettings, onAdvanced, onSearch }: { workspace: Workspace; value: string; setValue(value: string): void; editing: Message | null; clearEdit(): void; onSettings(): void; onAdvanced(): void; onSearch(): void }) {
  const { toast } = useFeedback(); const [files, setFiles] = useState<Attachment[]>([]); const [uploading, setUploading] = useState(false); const [drag, setDrag] = useState(false); const [picker, setPicker] = useState(false); const [projectFiles, setProjectFiles] = useState<Attachment[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null); const fileInput = useRef<HTMLInputElement>(null); const imageInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (textarea.current) { textarea.current.style.height = '0px'; textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 220)}px`; } }, [value]);
  async function upload(list: FileList | File[]) {
    if (uploading) return; const selected = Array.from(list); if (selected.length + files.length > 8) { toast('파일은 한 번에 최대 8개입니다.', true); return; } setUploading(true);
    try { for (const file of selected) { const form = new FormData(); form.set('file', file); const saved = await apiFetch<Attachment>('/api/files', { method: 'POST', body: form }); setFiles(old => [...old, saved]); } }
    catch (error) { toast((error as Error).message, true); } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; if (imageInput.current) imageInput.current.value = ''; }
  }
  async function send() {
    if (w.busy || uploading || !value.trim() && !files.length) return;
    const text = value; const selected = [...files]; const originals = editing ? w.attachments.filter(x => editing.metadata.attachmentIds?.includes(x.id)) : [];
    setValue(''); setFiles([]); const accepted = await w.send({ content: text, files: [...originals, ...selected], parentMessageId: editing ? editing.parentMessageId : undefined });
    if (accepted) clearEdit(); else { setValue(text); setFiles(selected); }
  }
  async function openFiles() { if (!w.projectId) { toast('프로젝트를 선택하면 프로젝트 파일을 사용할 수 있습니다.'); return; } try { setProjectFiles(await apiFetch<Attachment[]>(`/api/files?projectId=${w.projectId}`)); setPicker(true); } catch (error) { toast((error as Error).message, true); } }
  const commands = [ { name: '/new', detail: '새 대화' }, { name: '/code', detail: '코드 모드' }, { name: '/search', detail: '대화 검색' }, { name: '/model', detail: '모델 관리' }, { name: '/files', detail: '파일 첨부' }, { name: '/clear', detail: '입력 지우기' } ];
  function runCommand(name: string) {
    setValue('');
    if (name === '/new') w.newChat(w.projectId);
    if (name === '/code') w.setMode('code');
    if (name === '/search') onSearch();
    if (name === '/model') onSettings();
    if (name === '/files') fileInput.current?.click();
  }

  const english = w.data?.settings.language === 'en';
  return <div className="composer-wrap"><div className={`composer ${drag ? 'drag-active' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}>
    {editing && <div className="edit-banner"><Code2 size={14} />이 질문에서 새 분기를 만듭니다.<button aria-label="수정 취소" onClick={() => { clearEdit(); setValue(''); }}><X size={15} /></button></div>}
    {files.length > 0 && <div className="attachment-list">{files.map(file => <span className="file-chip" key={file.id}><File size={16} /><span>{file.name}<small>{(file.size / 1024).toFixed(0)} KB</small></span><button aria-label={`${file.name} 첨부 해제`} onClick={() => setFiles(old => old.filter(x => x.id !== file.id))}><X size={14} /></button></span>)}</div>}
    {value.startsWith('/') && !value.includes(' ') && <div className="slash-menu">{commands.filter(x => x.name.startsWith(value)).map(command => <button key={command.name} onClick={() => runCommand(command.name)}><strong>{command.name}</strong>{command.detail}</button>)}</div>}
    <textarea ref={textarea} aria-label="메시지 입력" placeholder={drag ? '여기에 파일을 놓으세요' : english ? 'Ask anything, or build something…' : w.mode === 'code' ? '함께 만들 코드를 설명해 주세요…' : '무엇이든 물어보거나, 함께 만들어 보세요…'} value={value} rows={2} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && w.data?.settings.enterToSend) { e.preventDefault(); void send(); } }} onPaste={e => { const images = Array.from(e.clipboardData.items).filter(x => x.type.startsWith('image/')).map(x => x.getAsFile()).filter((x): x is File => !!x); if (images.length) { e.preventDefault(); void upload(images); } }} />
    <div className="composer-toolbar"><div className="composer-tools"><details className="popover"><summary className="icon-button" aria-label="첨부 메뉴">{uploading ? <Loader2 className="spin" size={20} /> : <Plus size={22} />}</summary><div className="popover-menu upwards"><button onClick={() => fileInput.current?.click()}><Paperclip size={16} />파일 업로드</button><button onClick={() => imageInput.current?.click()}><ImagePlus size={16} />이미지 업로드</button><button onClick={() => void openFiles()}><File size={16} />프로젝트 파일 선택</button><small>최대 2MB / 파일 · 8개</small></div></details><details className="popover"><summary className={`tool-trigger ${w.mode === 'code' ? 'active' : ''}`}><SlidersHorizontal size={16} /><span>{w.mode === 'code' ? '코드 모드' : english ? 'Tools' : '도구'}</span></summary><div className="popover-menu upwards"><button onClick={() => w.setMode(w.mode === 'code' ? 'chat' : 'code')}><Code2 size={16} />코드 모드 {w.mode === 'code' ? '끄기' : '켜기'}</button><button onClick={() => fileInput.current?.click()}><File size={16} />파일 분석</button><button onClick={onAdvanced}><SlidersHorizontal size={16} />모델 옵션 / System Prompt</button><small>웹 검색 · 코드 실행: 준비 중</small></div></details></div><div className="composer-send"><ModelSelector models={w.data?.models || []} providers={w.data?.providers || []} value={w.modelId} onChange={w.setModelId} onFavorite={model => void w.favorite(model).catch(error => toast(error.message, true))} onSettings={onSettings} disabled={w.busy} />{w.busy ? <button className="send-button" aria-label="생성 중단" onClick={w.stop}><Square size={16} fill="currentColor" /></button> : <button className="send-button" aria-label="메시지 보내기" onClick={() => void send()} disabled={uploading || !w.modelId || !value.trim() && !files.length}><ArrowUp size={21} /></button>}</div></div>
    <input ref={fileInput} type="file" multiple hidden onChange={e => e.target.files && void upload(e.target.files)} /><input ref={imageInput} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => e.target.files && void upload(e.target.files)} />
  </div><p className="composer-disclaimer">{english ? 'AI can make mistakes. Check important information.' : 'AI는 실수할 수 있습니다. 중요한 정보는 다시 확인하세요.'}</p><Dialog open={picker} onClose={() => setPicker(false)} title="프로젝트 파일"><div className="dialog-body">{!projectFiles.length && <p className="muted">프로젝트에 파일을 먼저 추가해 주세요.</p>}{projectFiles.map(file => <label className="check-row" key={file.id}><input type="checkbox" checked={files.some(x => x.id === file.id)} onChange={e => setFiles(old => e.target.checked ? old.length < 8 ? [...old, file] : old : old.filter(x => x.id !== file.id))} />{file.name}</label>)}<button className="button primary" onClick={() => setPicker(false)}>선택 완료</button></div></Dialog></div>;
}
