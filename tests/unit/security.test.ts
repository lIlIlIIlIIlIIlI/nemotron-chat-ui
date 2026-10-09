import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret } from '../../lib/security/crypto';
import { isPublicAddress, validateProviderUrl } from '../../lib/security/provider-network';
import { validateFile } from '../../lib/files';
process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
test('AES-GCM authenticates owner and ciphertext; nonce is unique', () => {
  const key='test-only-provider-key'; const first=encryptSecret(key,'u:p');
  assert.notEqual(first,encryptSecret(key,'u:p')); assert.ok(!first.includes(key)); assert.equal(decryptSecret(first,'u:p'),key); assert.throws(()=>decryptSecret(first,'other'));
  const parts=first.split('.'); const data=Buffer.from(parts[3],'base64');data[0]^=1;parts[3]=data.toString('base64');assert.throws(()=>decryptSecret(parts.join('.'),'u:p'));
});
test('SSRF: private IPs, mapped private IPs, unapproved schemes and hosts',()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','192.168.0.1','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(isPublicAddress(ip),false,ip);
  assert.equal(isPublicAddress('8.8.8.8'),true);
  for(const url of ['http://api.openai.com/v1','https://api.openai.com.evil.example/v1','https://u:p@api.openai.com/v1','https://api.openai.com:8443/v1'])assert.throws(()=>validateProviderUrl(url));
  assert.equal(validateProviderUrl('https://integrate.api.nvidia.com/v1').hostname,'integrate.api.nvidia.com');
});
test('file validation checks bytes, size, UTF-8 and forbidden formats',()=>{
  assert.throws(()=>validateFile('fake.png',Buffer.from('not png'),'image/png'));
  assert.throws(()=>validateFile('evil.svg',Buffer.from('<svg/>'),'image/svg+xml'));
  assert.throws(()=>validateFile('a.txt',Buffer.from([0xff,0]),'text/plain'));
  assert.throws(()=>validateFile('large.txt',Buffer.alloc(2097153),'text/plain'));
  assert.equal(validateFile('source.ts',Buffer.from('const n=1'),'text/plain').text,'const n=1');
});
