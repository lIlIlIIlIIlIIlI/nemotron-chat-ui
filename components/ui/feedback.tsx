'use client';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { Dialog } from './dialog';
type Feedback = { toast(message: string, error?: boolean): void; confirm(message: string): Promise<boolean> };
const Context = createContext<Feedback>({ toast: () => {}, confirm: async () => false });
export const useFeedback = () => useContext(Context);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null); const [question, setQuestion] = useState('');
  const resolver = useRef<((answer: boolean) => void) | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((message: string, error = false) => { setNotice({ message, error }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(null), 7000); }, []);
  const confirm = useCallback((message: string) => new Promise<boolean>(done => { resolver.current?.(false); resolver.current = done; setQuestion(message); }), []);
  function answer(value: boolean) { resolver.current?.(value); resolver.current = null; setQuestion(''); }
  return <Context.Provider value={{ toast, confirm }}>{children}{notice && <div className={`toast ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.error ? <AlertCircle size={19} /> : <Check size={19} />}<span>{notice.message}</span><button aria-label="알림 닫기" onClick={() => setNotice(null)}><X size={16} /></button></div>}<Dialog open={!!question} onClose={() => answer(false)} title="확인"><div className="dialog-body"><p>{question}</p><div className="form-actions"><button className="button" onClick={() => answer(false)}>취소</button><button className="button danger" onClick={() => answer(true)}>확인</button></div></div></Dialog></Context.Provider>;
}
