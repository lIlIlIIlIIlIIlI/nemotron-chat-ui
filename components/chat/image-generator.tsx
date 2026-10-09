'use client';
import { useState } from 'react';
import { ImagePlus, Download, Loader2, X } from 'lucide-react';

export function ImageGenerator({ onClose, initialPrompt = '' }: { onClose(): void; initialPrompt?: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [size, setSize] = useState('1024');
  const [reference, setReference] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  async function readFile(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('PNG/JPEG/WebP 이미지(최대 2MB)를 선택해 주세요.'); return;
    }
    setReference(await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    }).catch(() => { setError('이미지를 읽지 못했습니다.'); return ''; }));
    setError('');
  }
  async function generate() {
    if (!prompt.trim() || working) return;
    setWorking(true); setOutput(null); setError('');
    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), width: Number(size), height: Number(size), ...(reference ? { image: reference } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '이미지 생성에 실패했습니다.');
      setOutput(result.image);
    } catch (e) { setError(e instanceof Error ? e.message : '이미지 생성에 실패했습니다.'); }
    finally { setWorking(false); }
  }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !working) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="FLUX 이미지 생성" className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 shadow-2xl" style={{ background: 'var(--background, #202020)', color: 'var(--foreground, #fff)' }}>
      <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-semibold">FLUX.2 이미지 생성</h2><button aria-label="닫기" onClick={onClose}><X size={20}/></button></div>
      <label className="block mb-2 text-sm">이미지 설명</label>
      <textarea className="w-full rounded-lg border p-3 bg-transparent" rows={4} maxLength={4000} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="생성할 이미지를 자세히 설명해 주세요." />
      <div className="flex items-center gap-3 mt-3"><label htmlFor="flux-size">이미지 크기</label><select id="flux-size" className="rounded-lg border bg-transparent p-2" value={size} onChange={e => setSize(e.target.value)}><option value="512">512 × 512</option><option value="768">768 × 768</option><option value="1024">1024 × 1024</option></select></div>
      <label className="mt-4 flex items-center gap-2 cursor-pointer text-sm"><ImagePlus size={18}/>참조 이미지 추가 (선택)<input type="file" accept="image/png,image/jpeg,image/webp" className="max-w-[210px] text-xs" onChange={e => void readFile(e.target.files?.[0])}/></label>
      {reference && <button className="mt-2 text-sm underline" onClick={() => setReference(null)}>참조 이미지 제거</button>}
      {error && <p role="alert" className="mt-3 text-red-400 text-sm">{error}</p>}
      <button className="button primary mt-4 w-full justify-center" disabled={working || !prompt.trim()} onClick={() => void generate()}>{working ? <><Loader2 size={16} className="animate-spin"/>생성 중…</> : '이미지 생성'}</button>
      {output && <div className="mt-5"><img src={output} alt={prompt} className="w-full rounded-lg" /><a className="button mt-3 inline-flex gap-2" href={output} download="flux-image.png"><Download size={16}/>PNG 다운로드</a></div>}
    </section>
  </div>;
}
