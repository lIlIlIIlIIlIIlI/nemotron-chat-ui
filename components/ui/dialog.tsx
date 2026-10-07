'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Dialog({ open, onClose, title, children, className = '' }: { open: boolean; onClose(): void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (open && !d?.open) d?.showModal(); else if (!open && d?.open) d.close(); }, [open]);
  return <dialog ref={ref} className={`dialog ${className}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}><div className="dialog-shell"><header className="dialog-header"><h2>{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={19} /></button></header>{open && children}</div></dialog>;
}
