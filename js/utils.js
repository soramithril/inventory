// ── UTILS.JS ──────────────────────────────────────────
// Supabase REST fetch + toast + modal helpers.

async function sbF(m,p,b){
  // Use the logged-in user's access token if available, else fall back to anon key
  let authHeader=SUPABASE_ANON_KEY;
  try{const sess=JSON.parse(localStorage.getItem("ss_session")||"{}");if(sess.access_token)authHeader=sess.access_token;}catch(e){}
  const isUpsert=m==="POST"&&p.includes("on_conflict");
  const prefer=isUpsert?"return=representation,resolution=merge-duplicates":m==="POST"?"return=representation":"";
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${p}`,{method:m,headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${authHeader}`,"Content-Type":"application/json",...(prefer?{Prefer:prefer}:{})},body:b?JSON.stringify(b):undefined});
  // If 401/403, try refreshing the token and retry once
  if((r.status===401||r.status===403)&&authHeader!==SUPABASE_ANON_KEY){
    const refreshed=await refreshSession();
    if(refreshed){
      const sess2=JSON.parse(localStorage.getItem("ss_session")||"{}");
      const r2=await fetch(`${SUPABASE_URL}/rest/v1/${p}`,{method:m,headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${sess2.access_token}`,"Content-Type":"application/json",...(prefer?{Prefer:prefer}:{})},body:b?JSON.stringify(b):undefined});
      if(!r2.ok)throw new Error(await r2.text());
      return r2.status===204?null:r2.json();
    }
    toast("Session expired — please sign in again","error");
    doLogout();
    throw new Error("Session expired");
  }
  if(!r.ok)throw new Error(await r.text());
  return r.status===204?null:r.json();
}

let toastT;
const TOAST_ICONS={success:"✓",error:"✕",info:"ℹ"};
function toast(msg,type="success"){
  const el=document.getElementById("toast");
  el.className=type+" show";
  el.innerHTML=`<span class="t-icon">${TOAST_ICONS[type]||"✓"}</span><span class="t-msg">${msg}</span><span class="t-close" onclick="dismissToast()">✕</span>`;
  clearTimeout(toastT);
  toastT=setTimeout(()=>dismissToast(),3200);
}
function dismissToast(){
  const el=document.getElementById("toast");
  el.classList.remove("show");el.classList.add("hide");
  setTimeout(()=>{el.className="";el.innerHTML="";},280);
}

function closeModal(){const o=document.getElementById("moverlay");if(o)o.remove();}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
function openModal(html,width){
  closeModal();
  const ov=document.createElement("div");ov.className="moverlay open";ov.id="moverlay";
  ov.onmousedown=e=>{if(e.target===ov)closeModal();};
  const m=document.createElement("div");m.className="modal";
  if(width)m.style.width=width;
  m.innerHTML=html;ov.appendChild(m);document.body.appendChild(ov);
}
