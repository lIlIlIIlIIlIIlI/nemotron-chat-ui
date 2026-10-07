'use client';
import { Children, isValidElement, memo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, Download, PanelRightOpen, WrapText } from 'lucide-react';
import { copyText, download } from '@/lib/client';
export type CodeSelection = { content: string; language: string; name: string };
function textContent(value: ReactNode): string { if (typeof value === 'string' || typeof value === 'number') return String(value); if (isValidElement<{ children?: ReactNode }>(value)) return textContent(value.props.children); return Children.toArray(value).map(textContent).join(''); }
const schema = { ...defaultSchema, attributes: { ...defaultSchema.attributes, code: [['className', /^language-./, 'math-inline', 'math-display']], span: [['className', 'math-inline', 'math-display']] } };
function CodeBlock({ children, onArtifact }: { children: ReactNode; onArtifact?(code: CodeSelection): void }) {
  const [copied, setCopied] = useState(false); const [wrap, setWrap] = useState(false); const [error,setError] = useState('');
  const child = Children.toArray(children).find(x => isValidElement(x));
  const language = isValidElement<{ className?: string }>(child) ? /language-([^\s]+)/.exec(child.props.className || '')?.[1] || 'text' : 'text';
  const content = textContent(children).replace(/\n$/, '');
  const extensions: Record<string, string> = { javascript: 'js', typescript: 'ts', python: 'py', shell: 'sh', bash: 'sh', rust: 'rs', ruby: 'rb' }; const name = `snippet.${extensions[language] || language}`;
  return <div className="code-block"><div className="code-toolbar"><span>{language}</span><div><button aria-label="코드 줄바꿈" aria-pressed={wrap} onClick={() => setWrap(!wrap)}><WrapText size={14} /></button><button aria-label="코드 다운로드" onClick={() => download(name, content)}><Download size={14} /></button>{onArtifact && <button aria-label="Artifact 열기" onClick={() => onArtifact({ content, language, name })}><PanelRightOpen size={14} /></button>}<button aria-label="코드 복사" onClick={() => void copyText(content).then(() => { setCopied(true); setError(''); setTimeout(() => setCopied(false), 1800); }).catch(() => setError('복사 권한을 확인해 주세요.'))}>{copied ? <Check size={14} /> : <Copy size={14} />}<span>{copied ? '복사됨' : '복사'}</span></button></div></div>{error && <small role="alert">{error}</small>}<pre className={wrap ? 'wrap-code' : ''}>{children}</pre></div>;
}
export const Markdown = memo(function Markdown({ content, onArtifact }: { content: string; onArtifact?(code: CodeSelection): void }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeSanitize, schema], [rehypeKatex, { throwOnError: false, trust: false, strict: 'ignore' }], [rehypeHighlight, { detect: false, ignoreMissing: true }]]} components={{ pre: ({ children }) => <CodeBlock onArtifact={onArtifact}>{children}</CodeBlock>, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>, img: ({ alt }) => <span className="muted">[외부 이미지: {alt || 'image'}]</span> }}>{content}</ReactMarkdown></div>;
});
