import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeImage, imageIntent } from '../../lib/ai/image-service';

test('identify image generation intent without matching tutorials', () => {
  assert.equal(imageIntent('하마가 노래 부르고 있는 그림 그려줘'), true);
  assert.equal(imageIntent('귀여운 고양이 이미지 생성해줘'), true);
  assert.equal(imageIntent('이미지 생성 API 만드는 방법 알려줘'), false);
  assert.equal(imageIntent('이 코드를 분석해줘'), false);
});

test('recognize PNG JPEG WebP by image signature', () => {
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(20)]);
  assert.equal(decodeImage(png.toString('base64')).mimeType, 'image/png');
  const jpg = Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1,2,3,255,217]);
  assert.equal(decodeImage(jpg.toString('base64')).extension, 'jpg');
  const webp = Buffer.from('RIFF....WEBPVP8 ', 'ascii');
  assert.equal(decodeImage(webp.toString('base64')).mimeType, 'image/webp');
});

test('reject invalid image bytes', () => {
  assert.throws(() => decodeImage('$$'));
  assert.throws(() => decodeImage(Buffer.from('not an image').toString('base64')));
});
