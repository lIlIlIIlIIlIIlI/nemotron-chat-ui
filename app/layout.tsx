import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: process.env.NEXT_PUBLIC_APP_NAME || 'Nemotron Workspace', description: '여러 AI 모델과 함께 생각하고 코드를 만드는 나만의 워크스페이스.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
