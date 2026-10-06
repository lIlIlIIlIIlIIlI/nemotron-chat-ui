import { AppError } from './http';
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const TEXT_EXTENSIONS = new Set(['txt','md','markdown','json','csv','js','mjs','ts','tsx','jsx','py','java','c','cpp','h','hpp','cs','go','rs','html','css','yaml','yml','xml','sql','sh','bash','rb','php','swift','kt','toml','ini','log','vue','svelte']);
export function validateFile(name: string, buffer: Buffer, claimedType: string) {
  if (!buffer.length || buffer.length > MAX_FILE_SIZE) throw new AppError('FILE_SIZE', '파일은 1바이트 이상, 2MB 이하여야 합니다.', 413);
  const extension = name.toLowerCase().split('.').at(-1) || '';
  const imageSignatures: { mime: string; extensions: string[]; valid: boolean }[] = [
    { mime: 'image/png', extensions: ['png'], valid: buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
    { mime: 'image/jpeg', extensions: ['jpg','jpeg'], valid: buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 },
    { mime: 'image/gif', extensions: ['gif'], valid: /^GIF8[79]a$/.test(buffer.subarray(0,6).toString('ascii')) },
    { mime: 'image/webp', extensions: ['webp'], valid: buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP' },
  ];
  const image = imageSignatures.find(x => x.extensions.includes(extension));
  if (image) { if (!image.valid || claimedType && claimedType !== image.mime && claimedType !== 'application/octet-stream') throw new AppError('FILE_MIME', '이미지 내용과 파일 형식이 일치하지 않습니다.'); return { mimeType: image.mime, text: null }; }
  if (extension === 'pdf') { if (buffer.subarray(0,5).toString() !== '%PDF-') throw new AppError('FILE_MIME', '유효한 PDF 파일이 아닙니다.'); return { mimeType: 'application/pdf', text: null }; }
  if (!TEXT_EXTENSIONS.has(extension)) throw new AppError('FILE_TYPE', '텍스트·코드·PDF·PNG·JPG·GIF·WebP를 지원합니다. Office 문서는 PDF 또는 텍스트로 변환해 주세요.');
  try { const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); if (text.includes('\0')) throw new Error(); return { mimeType: 'text/plain', text }; }
  catch { throw new AppError('FILE_MIME', '텍스트 파일은 UTF-8 형식이어야 합니다.'); }
}
