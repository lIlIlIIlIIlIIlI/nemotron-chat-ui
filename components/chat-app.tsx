'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { Asterisk, Bug, Code2, Columns3, FileSearch, FileText, Folder, Lightbulb, PanelLeft, Share2, Terminal, Upload, SlidersHorizontal, ImagePlus } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { useMobile } from '@/hooks/use-mobile';
import { apiFetch, download } from '@/lib/client';
import { activeBranch } from '@/lib/branches';
import type { Artifact, Message } from '@/lib/types';
import { FeedbackProvider, useFeedback } from './ui/feedback';
import { Sidebar } from './chat/sidebar';
import { Composer } from './chat/composer';
import { ImageGenerator } from './chat/image-generator';
import { Messages } from './chat/messages';
import { AdvancedSettings } from './chat/model-selector';
import type { CodeSelection } from './chat/markdown';
const SettingsDialog = dynamic(() => import('./settings/settings-dialog').then(x => x.SettingsDialog));
const ProjectDialog = dynamic(() => import('./projects/project-dialog').then(x => x.ProjectDialog));
const SearchDialog = dynamic(() => import('./chat/search-dialog').then(x => x.SearchDialog));
const ShareDialog = dynamic(() => import('./chat/share-dialog').then(x => x.ShareDialog));
const CompareDialog = dynamic(() => import('./chat/compare-dialog').then(x => x.CompareDialog));
const ArtifactPanel = dynamic(() => import('./chat/artifact-panel').then(x => x.ArtifactPanel));
export function ChatApp() { return <FeedbackProvider><WorkspaceApp /></FeedbackProvider>; }
function WorkspaceApp() {
  const base = useWorkspace(); const { toast } = useFeedback(); const mobile = useMobile();
  const [collapsed, setCollapsed] = useState(false); const [drawer, setDrawer] = useState(false); const sidebar = mobile ? drawer : !collapsed;
  const [width, setWidth] = useState(264); const [settings, setSettings] = useState<string | null>(null); const [search, setSearch] = useState(false); const [project, setProject] = useState<{ id: string | null } | null>(null); const [share, setShare] = useState(false); const [compare, setCompare] = useState(false); const [advanced, setAdvanced] = useState(false); const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [imageDialog, setImageDialog] = useState(false); const [draft, setDraft] = useState(''); const [editing, setEditing] = useState<Message | null>(null);
  const w = { ...base, newChat: (id: string | null = null) => { setEditing(null); setDraft(''); setArtifact(null); base.newChat(id); }, openConversation: async (id: string) => { setEditing(null); setDraft(''); setArtifact(null); await base.openConversation(id); } };
  function closeSidebar() { if (mobile) setDrawer(false); else setCollapsed(true); }
  useEffect(() => {
    const p = base.data?.settings; if (!p) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = p.theme === 'system' ? media.matches ? 'dark' : 'light' : p.theme; document.documentElement.lang = p.language; document.documentElement.style.setProperty('--message-font-size', `${p.fontSize}px`); document.documentElement.dataset.compact = String(p.compact); document.documentElement.dataset.codeTheme = p.codeTheme; };
    apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply);
  }, [base.data?.settings]);
  const { newChat, stop } = base;
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); setEditing(null); setDraft(''); setArtifact(null); }
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { stop(); setDrawer(false); }
    }; window.addEventListener('keydown',keydown); return () => window.removeEventListener('keydown',keydown);
  }, [newChat, stop]);
  useEffect(() => {
    if (!sidebar || !mobile) return; const previous = document.activeElement as HTMLElement | null; const aside = document.querySelector<HTMLElement>('.sidebar');
    const elements = () => Array.from(aside?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href], summary') || []).filter(x => x.offsetParent); elements()[0]?.focus();
    const trap = (e: KeyboardEvent) => { if (e.key !== 'Tab' || document.querySelector('dialog[open]')) return; const all = elements(); if (!all.length) return; if (e.shiftKey && document.activeElement === all[0]) { e.preventDefault(); all.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === all.at(-1)) { e.preventDefault(); all[0]?.focus(); } };
    document.addEventListener('keydown',trap); return () => { document.removeEventListener('keydown',trap); previous?.focus(); };
  }, [sidebar, mobile]);
  async function openArtifact(messageId: string, code: CodeSelection) {
    try { const existing = await apiFetch<Artifact[]>(`/api/artifacts?messageId=${messageId}`); setArtifact(existing.find(x => x.versions.includes(code.content)) || await apiFetch<Artifact>('/api/artifacts', { method: 'POST', body: JSON.stringify({ messageId,...code }) })); }
    catch (error) { toast((error as Error).message,true); }
  }
  function exportChat(format: string) {
    if (!w.conversation) return; const nodes = activeBranch(w.messages,w.conversation.activeLeafId); const title = w.conversation.title;
    const text = format === 'json' ? JSON.stringify({ title, messages: nodes.map(({ role,content,createdAt }) => ({ role,content,createdAt })) },null,2) : `${format === 'md' ? '# ' : ''}${title}\n\n` + nodes.map(m => `${format === 'md' ? '## ' : ''}${m.role === 'user' ? 'User' : 'Assistant'}\n\n${m.content}`).join('\n\n'); download(`${title}.${format}`,text,format === 'json' ? 'application/json' : 'text/plain');
  }
  const quick = [{ icon: Code2, label: '코드 작성', prompt: '다음 기능을 구현하는 코드를 작성해 주세요: ', code: true }, { icon: Terminal, label: '코드 분석', prompt: '다음 코드의 구조와 개선할 점을 분석해 주세요:\n\n', code: true }, { icon: Bug, label: '버그 수정', prompt: '다음 오류의 원인을 찾고 수정해 주세요:\n\n', code: true }, { icon: FileText, label: '문서 작성', prompt: '다음 내용을 명확한 문서로 정리해 주세요: ' }, { icon: Lightbulb, label: '아이디어', prompt: '다음 주제에 대해 아이디어를 함께 발전시켜 주세요: ' }, { icon: FileSearch, label: '파일 분석', prompt: '첨부한 파일의 핵심 내용과 개선할 점을 분석해 주세요. ' }];
  const english = w.data?.settings.language === 'en';
  const composer = <Composer key={w.conversation?.id || `new-${w.projectId}`} workspace={w} value={draft} setValue={setDraft} editing={editing} clearEdit={() => setEditing(null)} onSettings={() => setSettings('providers')} onAdvanced={() => setAdvanced(true)} onSearch={() => setSearch(true)} />;
  if (w.error) return <main className="full-empty"><Asterisk size={38} /><h1>워크스페이스를 열지 못했습니다</h1><p className="error-text">{w.error}</p><button className="button" onClick={() => window.location.reload()}>다시 시도</button></main>;
  if (!w.data) return <main className="app-loading" aria-busy="true"><div className="sidebar-skeleton" /><div className="loading-center"><Asterisk size={42} className="spin-slow" /><p>워크스페이스를 불러오는 중…</p></div></main>;
  return <div className={`workspace ${sidebar ? 'sidebar-open' : 'sidebar-closed'} ${artifact ? 'has-artifact' : ''}`} style={{ '--sidebar-width': `${width}px` } as CSSProperties}>
    {sidebar && <button className="sidebar-backdrop" aria-label="모바일 메뉴 닫기" onClick={closeSidebar} />}<div className="sidebar-container" inert={!sidebar}><Sidebar workspace={w} onClose={closeSidebar} onSearch={() => setSearch(true)} onSettings={() => setSettings('general')} onProject={id => setProject({ id: id || null })} /><div className="sidebar-resizer" role="separator" aria-label="사이드바 너비 조절" aria-orientation="vertical" aria-valuenow={width} aria-valuemin={220} aria-valuemax={360} tabIndex={sidebar ? 0 : -1} onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={e => { if (e.buttons === 1) setWidth(Math.max(220,Math.min(360,e.clientX))); }} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setWidth(x => Math.max(220,Math.min(360,x + (e.key === 'ArrowRight' ? 10 : -10)))); } }} /></div>
    <main className="main-workspace" inert={mobile && drawer}><header className="workspace-header"><div>{!sidebar && <button className="icon-button" aria-label="사이드바 열기" onClick={() => { setCollapsed(false); setDrawer(true); }}><PanelLeft size={20} /></button>}<span className="workspace-title">{w.projectId ? <><Folder size={17} />{w.data.projects.find(x => x.id === w.projectId)?.name || '프로젝트'}</> : <>Nemotron<span className="workspace-badge">Workspace</span></>}</span></div><div className="header-actions"><button className="button subtle small" onClick={() => setImageDialog(true)}><ImagePlus size={16}/><span>이미지 생성</span></button><button className="button subtle small" onClick={() => setCompare(true)}><Columns3 size={16} /><span>{english ? 'Compare' : '모델 비교'}</span></button><button className="icon-button" aria-label="대화 고급 설정" onClick={() => setAdvanced(true)}><SlidersHorizontal size={18} /></button>{w.conversation && <><button className="button subtle small" onClick={() => setShare(true)}><Share2 size={16} /><span>공유</span></button><details className="popover"><summary className="icon-button" aria-label="대화 내보내기"><Upload size={17} /></summary><div className="popover-menu align-right">{['md','json','txt'].map(format => <button key={format} onClick={() => exportChat(format)}>{format.toUpperCase()} 내보내기</button>)}</div></details></>}</div></header>
      {w.loadingChat ? <div className="messages loading-messages"><div className="skeleton" /><div className="skeleton short" /><div className="skeleton" /></div> : w.conversation ? <Messages key={w.conversation.id} workspace={w} onArtifact={(id,code) => void openArtifact(id,code)} onEdit={m => { setEditing(m); setDraft(m.content); }} /> : <section className="welcome"><div className="welcome-copy"><div className="welcome-symbol"><Asterisk size={44} strokeWidth={1.6} /></div><span className="eyebrow">A LITTLE CURIOSITY. ENDLESS POSSIBILITIES.</span><h1>{english ? 'What will we create today?' : '무엇을 함께 만들어볼까요?'}</h1><p>{english ? 'Think, code, and explore with your favorite AI.' : '아이디어를 나누고, 코드를 만들고, 가능성을 넓혀보세요.'}</p></div><div className="welcome-composer">{composer}</div><div className="quick-actions">{quick.map(({ icon: Icon,label,prompt,code }) => <button key={label} onClick={() => { setDraft(prompt); if (code) w.setMode('code'); document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus(); }}><Icon size={16} />{label}</button>)}</div>{!w.data.models.length && <button className="connect-nudge" onClick={() => setSettings('providers')}><span className="status-dot" />첫 대화를 위해 AI Provider를 연결해 주세요<span>연결하기 →</span></button>}</section>}
      {w.conversation && <div className="bottom-composer">{composer}</div>}
    </main>
    {imageDialog && <ImageGenerator onClose={() => setImageDialog(false)} />}
    {artifact && <ArtifactPanel key={artifact.id} artifact={artifact} onClose={() => setArtifact(null)} onUpdate={setArtifact} onModify={(content,name) => { setDraft(`${name} 코드를 다음 요구사항에 맞게 수정해 주세요:\n[수정할 내용]\n\n\`\`\`\n${content}\n\`\`\``); w.setMode('code'); }} />}
    {settings && <SettingsDialog workspace={w} initialTab={settings} onClose={() => setSettings(null)} />}{project && <ProjectDialog workspace={w} projectId={project.id} onClose={() => setProject(null)} />}{search && <SearchDialog onClose={() => setSearch(false)} onSelect={id => void w.openConversation(id)} />}{share && w.conversation && <ShareDialog conversationId={w.conversation.id} onClose={() => setShare(false)} />}{compare && <CompareDialog workspace={w} onClose={() => setCompare(false)} />}
    <AdvancedSettings open={advanced} onClose={() => setAdvanced(false)} model={w.data.models.find(x => x.id === w.modelId)} options={w.options} setOptions={w.setOptions} systemPrompt={w.systemPrompt} setSystemPrompt={w.setSystemPrompt} onSave={() => { if (w.conversation) void w.patchConversation(w.conversation.id, { systemPrompt: w.systemPrompt }).catch(error => toast(error.message,true)); setAdvanced(false); }} />
  </div>;
}
