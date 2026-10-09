import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeGeneratedImage } from '../../lib/ai/generated-image';

test('detect PNG and preserve bytes', () => {
  const sample = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(16)]);
  const image = decodeGeneratedImage({ image: sample.toString('base64') });
  assert.equal(image.mimeType, 'image/png');
  assert.equal(image.extension, 'png');
  assert.ok(image.bytes.equals(sample));
});
test('detect JPEG instead of assuming PNG', () => {
  const sample = Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1,2,3,255,217]);
  const image = decodeGeneratedImage({ image: sample.toString('base64') });
  assert.equal(image.mimeType, 'image/jpeg');
  assert.equal(image.extension, 'jpg');
});
test('detect WebP and handle data URL', () => {
  const sample = Buffer.from('RIFF........WEBPVP8 ', 'ascii');
  const image = decodeGeneratedImage({ image: 'data:image/webp;base64,' + sample.toString('base64') });
  assert.equal(image.mimeType, 'image/webp');
  assert.equal(image.extension, 'webp');
});
test('reject malformed image responses', () => {
  assert.throws(() => decodeGeneratedImage({ image: Buffer.from('not an image').toString('base64') }), /지원하지 않는/);
  assert.throws(() => decodeGeneratedImage({ image: '$$' }), /Base64/);
  assert.throws(() => decodeGeneratedImage({ image: 'A'.repeat(8_400_004) }), /Base64/);
});
