/** Identify Workers AI image bytes, not a Worker-supplied MIME label. */
export function decodeGeneratedImage(result: unknown) {
  if (!result || typeof result !== 'object' || !('image' in result) || typeof result.image !== 'string') {
    throw new Error('이미지 생성 서버에서 이미지 데이터가 누락되었습니다.');
  }
  const payload = result.image.trim();
  const dataUrl = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(payload);
  const base64 = dataUrl ? dataUrl[1] : payload;
  if (!base64 || base64.length > 8_400_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw new Error('이미지 생성 서버가 올바른 Base64 이미지를 반환하지 않았습니다.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length < 12 || bytes.length > 6 * 1024 * 1024 ||
    bytes.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
    throw new Error('생성 이미지 데이터가 손상되었거나 저장 용량 한도를 초과했습니다.');
  }
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw new Error('이미지 생성 서버가 지원하지 않는 이미지 형식을 반환했습니다.');
  const mimeType = png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp';
  const extension = png ? 'png' : jpeg ? 'jpg' : 'webp';
  return { bytes, base64: bytes.toString('base64'), mimeType, extension };
}
