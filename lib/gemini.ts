import 'server-only';

export async function analyzeJson<T>(instruction:string,payload:unknown):Promise<T|null>{
  const keys=[process.env.GEMINI_API_KEY_1,process.env.GEMINI_API_KEY_2,process.env.GEMINI_API_KEY_3,process.env.GEMINI_API_KEY].filter(Boolean) as string[];
  if(!keys.length)return null;
  const model=process.env.GEMINI_MODEL||'gemini-3-flash';
  for(const key of keys){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
        method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},
        body:JSON.stringify({contents:[{parts:[{text:`${instruction}\n\nDATA:\n${JSON.stringify(payload)}`}]}],generationConfig:{responseMimeType:'application/json'}}),
        signal:AbortSignal.timeout(25000),cache:'no-store'
      });
      if(!response.ok)continue;
      const result=await response.json();
      const text=result.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text??'').join('');
      if(text)return JSON.parse(text) as T;
    }catch{continue}
  }
  return null;
}
