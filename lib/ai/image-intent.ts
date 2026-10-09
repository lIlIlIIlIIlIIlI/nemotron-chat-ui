/** Explicit creation requests only; questions about images stay in text chat. */
export function wantsImage(prompt: string): boolean {
  const text = prompt.trim().toLowerCase();
  if (!text || text.length > 4000) return false;
  if (/(그리는 법|그리는 방법|만드는 법|만드는 방법|그려지는|그렸을 때|그려야 하나|이미지 생성 (api|코드|방법)|image generation (api|code|tutorial))/.test(text)) return false;
  return /(그려\s*줘|그려\s*주세요|그려\s*줄래|그려\s*주실|그림\s*(?:을\s*)?(?:그려|만들어)|이미지\s*(?:를|를\s*하나|하나)?\s*(?:만들어|생성해|그려)|사진\s*(?:을|하나)?\s*(?:만들어|생성해)|일러스트\s*(?:를)?\s*(?:그려|만들어|생성해)|포스터\s*(?:를)?\s*(?:만들어|제작해)|썸네일\s*(?:을)?\s*(?:만들어|제작해)|배경화면\s*(?:을)?\s*(?:만들어|생성해)|(?:generate|create|draw|paint|make)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|illustration|poster|thumbnail|wallpaper)|text\s*to\s*image)/i.test(text);
}
