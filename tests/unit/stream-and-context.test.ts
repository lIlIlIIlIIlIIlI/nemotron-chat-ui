import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSSE } from '../../lib/ai/sse';
import { fitContext } from '../../lib/ai/context';
import { activeBranch, newestDescendant } from '../../lib/branches';
import { openAIOptions } from '../../lib/ai/providers/openai-compatible';
import type { AIRequest } from '../../lib/ai/types';
test('SSE handles split UTF-8, CRLF, multi-line data and final unterminated frame',async()=>{
  const bytes=new TextEncoder().encode(': heartbeat\r\ndata: 한글\r\ndata: two\r\n\r\nevent: done\ndata: end');
  const stream=new ReadableStream<Uint8Array>({start(c){for(let i=0;i<bytes.length;i+=2)c.enqueue(bytes.slice(i,i+2));c.close();}});
  const events=[];for await(const event of parseSSE(stream))events.push(event);assert.deepEqual(events,[{event:'message',data:'한글\ntwo'},{event:'done',data:'end'}]);
});
test('context trimming preserves history and latest user question',()=>{
  const history=[{role:'user' as const,text:'old '.repeat(3000)},{role:'assistant' as const,text:'old answer'},{role:'user' as const,text:'latest'}];
  const result=fitContext('System',history,2048,512);assert.equal(result.trimmed,true);assert.deepEqual(result.messages,[history[2]]);assert.equal(history.length,3);assert.throws(()=>fitContext('x'.repeat(10000),history,1024,512));
});
test('branches preserve alternatives and recover each continuation',()=>{
  const nodes=[{id:'q',parentMessageId:null,createdAt:'1'},{id:'a1',parentMessageId:'q',createdAt:'2'},{id:'a2',parentMessageId:'q',createdAt:'3'}];
  assert.deepEqual(activeBranch(nodes,'a2').map(x=>x.id),['q','a2']);assert.equal(newestDescendant(nodes,'q'),'a2');assert.equal(activeBranch([{id:'loop',parentMessageId:'loop'}],'loop').length,1);
});
test('provider payload omits options the model does not support',()=>{
  const request={model:{supportedOptions:['maxTokens'],outputTokenParam:'max_completion_tokens',maxOutputTokens:100,capabilities:['text'],reasoningStyle:'none'},options:{temperature:1,topP:.9,maxTokens:1000,reasoningEffort:'high'}} as AIRequest;
  assert.deepEqual(openAIOptions(request),{max_completion_tokens:100});
});
