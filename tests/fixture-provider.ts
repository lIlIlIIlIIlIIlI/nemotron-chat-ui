// Deterministic local CI upstream. Never imported by application code.
import { createServer } from 'node:http';
const server=createServer(async(req,res)=>{
  if(req.url==='/health'){res.end('ok');return;}
  const credential=req.headers.authorization?.replace('Bearer ','')||req.headers['x-api-key']||req.headers['x-goog-api-key'];
  if(credential!=='fixture-valid-key'){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"invalid fixture credential"}');return;}
  if(req.method==='GET'&&req.url?.includes('/models')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'fixture-chat',name:'Fixture Chat',display_name:'Fixture Chat'},{id:'fixture-code',name:'Fixture Code',display_name:'Fixture Code'}],models:[{name:'models/fixture-gemini',displayName:'Fixture Gemini',supportedGenerationMethods:['generateContent']}]}));return;}
  let raw='';for await(const chunk of req)raw+=chunk;
  const slow=raw.includes('slow-stream');
  const answer='## 안녕하세요\n\n실제 서버 스트림으로 전달된 **테스트 답변**입니다.\n\n```typescript\nconst answer: number = 42;\nconsole.log(answer);\n```\n\n| 항목 | 결과 |\n|---|---|\n| Stream | OK |\n\n수식: $x^2$\n';
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
  const send=(data:unknown,event?:string)=>res.write(`${event?`event: ${event}\n`:''}data: ${JSON.stringify(data)}\n\n`);
  const anthropic=req.url?.endsWith('/messages');const gemini=req.url?.includes('streamGenerateContent');
  if(anthropic)send({type:'message_start',message:{usage:{input_tokens:12}}},'message_start');
  if(!anthropic&&!gemini)send({choices:[{delta:{reasoning_content:'DO_NOT_DISPLAY_RAW_REASONING'}}]});
  let position=0;
  const timer=setInterval(()=>{
    const content=answer.slice(position,position+8);position+=8;
    if(content){if(anthropic)send({type:'content_block_delta',delta:{type:'text_delta',text:content}},'content_block_delta');else if(gemini)send({candidates:[{content:{parts:[{text:content}]}}]});else send({choices:[{delta:{content}}]});}
    else {clearInterval(timer);if(anthropic){send({type:'message_delta',usage:{output_tokens:24}},'message_delta');send({type:'message_stop'},'message_stop');}else if(gemini)send({candidates:[{finishReason:'STOP'}],usageMetadata:{promptTokenCount:12,candidatesTokenCount:24,totalTokenCount:36}});else{send({choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:24,total_tokens:36}});res.write('data: [DONE]\n\n');}res.end();}
  },slow?500:35);
  res.on('close',()=>clearInterval(timer));
});
server.listen(4010,'127.0.0.1');
