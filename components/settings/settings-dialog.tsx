'use client';
import { useState } from 'react';
import { BarChart3, Database, Fingerprint, Info, Palette, Plug, Settings2, ShieldCheck, Cpu } from 'lucide-react';
import type { Workspace } from '@/hooks/use-workspace';
import { Dialog } from '../ui/dialog';
import { ProvidersPanel } from './providers-panel';
import { ModelsPanel } from './models-panel';
import { PreferencesPanel } from './preferences-panel';
import { SecurityPanel } from './security-panel';
import { DataPanel, UsagePanel } from './data-panel';
const tabs = [['general','General',Settings2],['appearance','Appearance',Palette],['providers','AI Providers',Plug],['models','Models',Cpu],['personalization','Personalization',Fingerprint],['data','Data Controls',Database],['security','Security',ShieldCheck],['usage','Usage',BarChart3],['about','About',Info]] as const;
export function SettingsDialog({ workspace: w, onClose, initialTab }: { workspace: Workspace; onClose(): void; initialTab: string }) {
  const [tab, setTab] = useState(initialTab);
  return <Dialog open onClose={onClose} title="설정" className="settings-dialog"><div className="settings-layout"><nav className="settings-nav" aria-label="설정 메뉴">{tabs.map(([id,label,Icon]) => <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}</nav><div className="settings-content">{w.data && <>{tab === 'providers' && <ProvidersPanel data={w.data} reload={w.loadData} />}{tab === 'models' && <ModelsPanel data={w.data} reload={w.loadData} />}{(tab === 'general' || tab === 'appearance' || tab === 'personalization') && <PreferencesPanel key={tab} workspace={w} section={tab} />}{tab === 'security' && <SecurityPanel />}{tab === 'data' && <DataPanel workspace={w} />}{tab === 'usage' && <UsagePanel />}{tab === 'about' && <section className="settings-section"><span className="eyebrow">NEMOTRON WORKSPACE · v2</span><h3>당신의 모델, 당신의 작업 공간.</h3><p>여러 AI Provider를 연결하고 대화와 코드를 한곳에서 관리합니다.</p><h4>키보드 단축키</h4><dl className="shortcut-list"><dt>Ctrl / ⌘ + K</dt><dd>대화 검색</dd><dt>Ctrl / ⌘ + Shift + O</dt><dd>새 대화</dd><dt>Esc</dt><dd>창 닫기 / 생성 중단</dd><dt>Shift + Enter</dt><dd>줄바꿈</dd></dl><h4>현재 지원 범위</h4><p className="muted">일반 채팅, 코딩 지원, 파일·이미지 컨텍스트, 버전과 모델 비교를 지원합니다. 웹 검색, 코드 실행, GitHub 코드 적용, 소셜 로그인은 아직 연결되지 않았습니다.</p><a href="https://github.com/lIlIlIIlIIlIIlI/nemotron-chat-ui" target="_blank" rel="noreferrer">GitHub에서 소스 보기 ↗</a></section>}</>}</div></div></Dialog>;
}
