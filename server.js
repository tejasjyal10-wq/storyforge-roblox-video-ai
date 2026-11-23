const express = require('express');
const path = require('path');
const app = express();
app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));
const BASE = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com').replace(/\/$/, '');
const MODEL = process.env.AGNES_VIDEO_MODEL || 'agnes-video-2.5-flash';
const KEY = process.env.AGNES_API_KEY;
const jobs = new Map();
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function providerReady(){ return Boolean(KEY && KEY.trim()); }
async function apiFetch(url, opts={}){
  const response = await fetch(url, {...opts, headers:{Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json', ...(opts.headers||{})}});
  const raw = await response.text(); let data;
  try { data=JSON.parse(raw); } catch { data={raw}; }
  if(!response.ok) throw new Error(`Provider ${response.status}: ${data?.message || data?.error || raw.slice(0,300)}`);
  return data;
}
app.get('/api/health', (_req,res)=>res.json({ok:true, providerConfigured:providerReady(), model:MODEL, mode:providerReady()?'provider':'setup-required'}));
app.post('/api/generate', async (req,res)=>{
  if(!providerReady()) return res.status(503).json({error:'Video API is not configured yet. Add AGNES_API_KEY to the server environment to enable real generation.'});
  const prompt = String(req.body?.prompt||'').trim();
  if(!prompt) return res.status(400).json({error:'Please enter a story or scene prompt.'});
  const seconds = Math.max(4, Math.min(12, Number(req.body.seconds)||8));
  const ratio = ['16:9','9:16','1:1'].includes(req.body.aspect_ratio) ? req.body.aspect_ratio : '16:9';
  const robloxStyle = 'Roblox-inspired 3D game animation, blocky toy-like avatar proportions, recognizable Roblox-style environment, consistent visual design, clean render, no real-world footage. ';
  const finalPrompt = robloxStyle + prompt;
  try {
    const data = await apiFetch(`${BASE}/v1/videos`, {method:'POST', body:JSON.stringify({model:MODEL,prompt:finalPrompt,mode:'text',seconds,size:'720P',aspect_ratio:ratio})});
    const videoId = data.video_id || data.id;
    if(!videoId) throw new Error('Provider response did not include video_id. Check API response format/model access.');
    const jobId = `sf_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    jobs.set(jobId,{jobId,videoId,model:MODEL,status:'queued',createdAt:Date.now(),providerData:data});
    res.json({jobId,status:'queued',model:MODEL});
  } catch(e){ res.status(502).json({error:e.message}); }
});
app.get('/api/jobs/:jobId', async (req,res)=>{
  const job=jobs.get(req.params.jobId);
  if(!job) return res.status(404).json({error:'Job not found. It may have expired after the server restarted.'});
  if(job.status==='completed'||job.status==='failed') return res.json(job);
  try {
    const params=new URLSearchParams({video_id:job.videoId,model_name:job.model});
    const data=await apiFetch(`${BASE}/agnesapi?${params}`);
    const status=String(data.status||'').toLowerCase();
    const url=data.url || data.video_url || data.output?.url || data.result?.url;
    if(['completed','complete','success','succeeded','done'].includes(status) && url){job.status='completed';job.videoUrl=url;job.providerData=data;}
    else if(['failed','error','cancelled'].includes(status)){job.status='failed';job.error=data.error||data.message||'Video generation failed';job.providerData=data;}
    else {job.status=status||'processing';job.progress=Number(data.progress)||0;}
    jobs.set(job.jobId,job);res.json(job);
  } catch(e){res.status(502).json({error:e.message,jobId:job.jobId,status:job.status});}
});
const PORT=process.env.PORT||3000;
if(require.main===module) app.listen(PORT,()=>console.log(`StoryForge running on port ${PORT}`));
module.exports={app,jobs};
