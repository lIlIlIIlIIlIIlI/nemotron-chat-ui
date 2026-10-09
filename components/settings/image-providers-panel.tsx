'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Image, KeyRound, Pencil, Plus, Plug, Trash2, X } from 'lucide-react';
import type { ImageProvider } from '@/lib/types';
import type { Workspace } from '@/hooks/use-workspace';
import { apiFetch } from '@/lib/client';
import { useFeedback } from '../ui/feedback';

type Form = Pick<ImageProvider,'name'|'type'|'baseUrl'|'modelId'|'isEnabled'> & { apiKey: string };
const presets: Record<ImageProvider['type'], {baseUrl:string;modelId:string}> = {
  openai: { baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-image-1.5' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', modelId: 'gemini-2.5-flash-image' },
  'openai-compatible': { baseUrl: 'https://example.com/v1', modelId: '' },
};
const fresh = (): Form => ({ name: 'OpenAI Images', type: 'openai', ...presets.openai, isEnabled: true, apiKey: '' });

export function ImageProvidersPanel({ workspace: w }: { workspace: Workspace }) {
  const { toast, confirm } = useFeedback();
  const [items,setItems] = useState<ImageProvider[]>([]);
  const [form,setForm] = useState<Form|null>(null);
  const [editing,setEditing] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [ready,setReady] = useState(false);
  const [auto,setAuto] = useState(Boolean(w.data?.settings.imageAutoEnabled));
  const [preferred,setPreferred] = useState(w.data?.settings.defaultImageProviderId || '');
  async function load() { const list = await apiFetch<ImageProvider[]>('/api/image-providers'); setItems(list); setReady(true); }
  useEffect(() => { void load().catch(error => toast((error as Error).message,true)); }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); if(!form) return;
    setBusy(true);
    try {
      await apiFetch(editing ? `/api/image-providers/${editing}` : '/api/image-providers',
        {method:editing?'PATCH':'POST',body:JSON.stringify({...form,apiKey: form.apiKey || undefined})});
      await load(); setForm(null); setEditing(null); toast('이미지 API가 암호화되어 저장되었습니다.');
    } catch(error) { toast((error as Error).message,true); }
    finally { setBusy(false); }
  }
  async function test(id: string) {
    setBusy(true);
    try { const r = await apiFetch<{message:string}>(`/api/image-providers/${id}/test`,{method:'POST',body:'{}'}); toast(r.message); }
    catch(error){ toast((error as Error).message,true); }
    finally { setBusy(false); }
  }
  async function savePreferences() {
    if(!w.data) return;
    if(auto && !preferred) { toast('자동 생성에 사용할 기본 이미지 API를 선택해 주세요.',true); return; }
    setBusy(true);
    try {
      await apiFetch('/api/settings',{method:'PUT',body:JSON.stringify({
        ...w.data.settings,imageAutoEnabled:auto,defaultImageProviderId:preferred || null,
      })});
      await w.loadData(); toast('이미지 생성 설정을 저장했습니다.');
    } catch(error){toast((error as Error).message,true);}
    finally {setBusy(false);}
  }
  return <section className="settings-section">
    <div className="section-heading"><div><h3>이미지 생성 API</h3><p>사용자별 API 키와 이미지 모델을 등록합니다. 비용은 해당 제공업체 계정에 청구될 수 있습니다.</p></div><button className="button primary" onClick={() => {setEditing(null);setForm(fresh());}} disabled={busy}><Plus size={16}/>API 추가</button></div>
    {ready && items.length===0 && <div className="empty-state"><Image size={30}/><p>등록된 이미지 API가 없습니다.</p><small>OpenAI, Gemini, OpenAI 호환 이미지 API를 연결해 주세요.</small></div>}
    {items.map(item => <div className="settings-list-row" key={item.id}>
      <Image size={20}/><div className="grow"><strong>{item.name}{!item.isEnabled?' · 비활성':''}</strong><small>{item.modelId} · {item.type}</small><small>{item.keyHint}</small></div>
      <button className="button small" disabled={busy} onClick={() => void test(item.id)}><Plug size={14}/>연결 확인</button>
      <button className="icon-button" aria-label={`${item.name} 수정`} onClick={() => {setEditing(item.id);setForm({name:item.name,type:item.type,baseUrl:item.baseUrl,modelId:item.modelId,isEnabled:item.isEnabled,apiKey:''});}}><Pencil size={16}/></button>
      <button className="icon-button" aria-label={`${item.name} 삭제`} disabled={busy} onClick={async()=>{
        if(await confirm(`${item.name} 이미지 API와 저장된 키를 삭제할까요? 기존 생성 이미지는 유지됩니다.`)) {
          try {await apiFetch(`/api/image-providers/${item.id}`,{method:'DELETE'}); if(preferred===item.id){setPreferred('');setAuto(false);}await load();}
          catch(error){toast((error as Error).message,true);}
        }
      }}><Trash2 size={16}/></button>
    </div>)}
    {form && <form className="sub-panel form-stack" onSubmit={e=>void save(e)}>
      <div className="section-heading"><h3>{editing?'이미지 API 수정':'이미지 API 등록'}</h3><button className="icon-button" type="button" onClick={()=>{setForm(null);setEditing(null);}}><X size={18}/></button></div>
      <label>API 형식<select value={form.type} onChange={e=>{const type=e.target.value as ImageProvider['type'];setForm({...form,type,...presets[type]});}}>
        <option value="openai">OpenAI Images</option><option value="gemini">Google Gemini</option><option value="openai-compatible">OpenAI 호환 Images API</option>
      </select></label>
      <label>표시 이름<input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label>Base URL<input required type="url" value={form.baseUrl} onChange={e=>setForm({...form,baseUrl:e.target.value})}/></label>
      <label>이미지 모델 ID<input required maxLength={160} value={form.modelId} onChange={e=>setForm({...form,modelId:e.target.value})}/></label>
      <label>API Key <input type="password" required={!editing} autoComplete="off" value={form.apiKey} onChange={e=>setForm({...form,apiKey:e.target.value})} placeholder={editing?'키를 변경할 때만 입력':'API Key'} /></label>
      {form.type==='openai-compatible' && <p className="fine-print">Custom API 호스트는 서버의 AI_ALLOWED_HOSTS에 등록해야 합니다. /images/generations 엔드포인트에서 b64_json을 지원해야 합니다.</p>}
      <label className="check-row"><input type="checkbox" checked={form.isEnabled} onChange={e=>setForm({...form,isEnabled:e.target.checked})}/>API 사용</label>
      <button disabled={busy} className="button primary"><KeyRound size={16}/>{busy?'저장 중…':'API 저장'}</button>
      <p className="fine-print">API 키는 서버에서 AES-256-GCM으로 암호화됩니다. 연결 확인은 모델 조회만 실행하며, 이미지 생성에 성공한다는 보장은 아닙니다.</p>
    </form>}
    <div className="sub-panel form-stack">
      <h3>채팅 이미지 생성</h3>
      <label>기본 이미지 생성 API<select value={preferred} onChange={e=>setPreferred(e.target.value)}><option value="">선택 안 함</option>{items.filter(x=>x.isEnabled).map(x=><option key={x.id} value={x.id}>{x.name} · {x.modelId}</option>)}</select></label>
      <label className="check-row"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>채팅에서 '그려줘' 등의 요청을 자동으로 이미지 생성</label>
      <p className="fine-print">기본값은 자동 생성 꺼짐입니다. 자동 생성 사용 시 API 요금이 발생할 수 있습니다. 채팅창에서 이미지 API를 직접 선택하면 자동 감지 설정과 관계없이 생성합니다.</p>
      <button className="button primary" disabled={busy} onClick={() => void savePreferences()}>이미지 생성 설정 저장</button>
    </div>
  </section>;
}
