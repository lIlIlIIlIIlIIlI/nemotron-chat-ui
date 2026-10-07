export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: string }> {
  const reader = stream.getReader(); const decoder = new TextDecoder(); let buffer = ''; let event = 'message'; let data: string[] = [];
  function line(value: string) {
    if (!value) { if (!data.length) { event = 'message'; return; } const item = { event, data: data.join('\n') }; data = []; event = 'message'; return item; }
    if (value.startsWith('event:')) event = value.slice(6).trimStart();
    if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
  }
  try {
    while (true) {
      const { value, done } = await reader.read(); buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let pos: number;
      while ((pos = buffer.indexOf('\n')) >= 0) { const item = line(buffer.slice(0, pos).replace(/\r$/, '')); buffer = buffer.slice(pos + 1); if (item) yield item; }
      if (buffer.length > 2 * 1024 * 1024) throw new Error('Oversized SSE event');
      if (done) break;
    }
    if (buffer) { const item = line(buffer.replace(/\r$/, '')); if (item) yield item; }
    const final = line(''); if (final) yield final;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
