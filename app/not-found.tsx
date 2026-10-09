import Link from 'next/link';
export default function NotFound() { return <main className="full-empty"><h1>페이지를 찾을 수 없습니다.</h1><p>공유가 해제되었거나 주소가 올바르지 않을 수 있습니다.</p><Link className="button" href="/">워크스페이스로 이동</Link></main>; }
