// ── AUTH.JS ──────────────────────────────────────────
// Login, session keep-alive, and inactivity timeout.
// Uses the same Supabase auth as the main JWG scheduler — employees sign in
// with the same username/email + password.

let _currentUser=null;

// ── SESSION KEEP-ALIVE: refresh token before it expires ──
let _refreshTimer=null;
async function refreshSession(){
  try{
    const stored=localStorage.getItem("ss_session");
    if(!stored)return false;
    const session=JSON.parse(stored);
    if(!session.refresh_token)return false;
    const ref=await sbAuth("token?grant_type=refresh_token",{refresh_token:session.refresh_token});
    if(ref.access_token){
      localStorage.setItem("ss_session",JSON.stringify(ref));
      _currentUser=ref.user;
      updateUserBadge(ref.user);
      console.log("[session] Token refreshed successfully");
      return true;
    }
  }catch(e){console.warn("[session] Refresh failed:",e);}
  return false;
}
let _visibilityHandler=null;
function startSessionKeepAlive(){
  clearInterval(_refreshTimer);
  // Refresh every 45 minutes (Supabase tokens expire after 1 hour)
  _refreshTimer=setInterval(async()=>{
    const ok=await refreshSession();
    if(!ok){
      toast("Your session expired — please sign in again","error");
      doLogout();
    }
  },45*60*1000);
  if(_visibilityHandler)document.removeEventListener("visibilitychange",_visibilityHandler);
  _visibilityHandler=async()=>{
    if(document.visibilityState==="visible"){
      const ok=await refreshSession();
      if(!ok){
        toast("Your session expired — please sign in again","error");
        doLogout();
      }
    }
  };
  document.addEventListener("visibilitychange",_visibilityHandler);
}

// ── INACTIVITY TIMEOUT: sign out after 30 min of no interaction ──
const IDLE_WARN_MS   = 25*60*1000;   // show warning at 25 min
const IDLE_LOGOUT_MS = 30*60*1000;   // force logout at 30 min
let _idleTimer=null, _idleWarnTimer=null, _idleCountdown=null, _idleSecondsLeft=0;

function resetInactivityTimer(){
  const overlay=document.getElementById("timeout-overlay");
  const wasWarning=overlay&&overlay.classList.contains("show");
  if(overlay)overlay.classList.remove("show");
  clearTimeout(_idleTimer);
  clearTimeout(_idleWarnTimer);
  clearInterval(_idleCountdown);

  if(!_currentUser)return;
  if(wasWarning)refreshSession();

  _idleWarnTimer=setTimeout(()=>showTimeoutWarning(), IDLE_WARN_MS);
  _idleTimer=setTimeout(()=>{
    toast("Signed out due to inactivity","info");
    doLogout();
  }, IDLE_LOGOUT_MS);
}

function showTimeoutWarning(){
  const overlay=document.getElementById("timeout-overlay");
  if(!overlay)return;
  overlay.classList.add("show");
  _idleSecondsLeft=Math.round((IDLE_LOGOUT_MS-IDLE_WARN_MS)/1000);
  updateCountdownDisplay();
  clearInterval(_idleCountdown);
  _idleCountdown=setInterval(()=>{
    _idleSecondsLeft--;
    if(_idleSecondsLeft<=0){clearInterval(_idleCountdown);return;}
    updateCountdownDisplay();
  },1000);
}

function updateCountdownDisplay(){
  const el=document.getElementById("timeout-countdown");
  if(!el)return;
  const m=Math.floor(_idleSecondsLeft/60);
  const s=_idleSecondsLeft%60;
  el.textContent=`${m}:${String(s).padStart(2,"0")}`;
}

function startInactivityTimer(){
  const events=["mousedown","mousemove","keydown","scroll","touchstart","click","input","change"];
  let _lastReset=0;
  function onActivity(){
    const now=Date.now();
    if(now-_lastReset<5000)return;
    _lastReset=now;
    resetInactivityTimer();
  }
  events.forEach(ev=>document.addEventListener(ev,onActivity,{passive:true}));
  resetInactivityTimer();
}

// ── AUTH FUNCTIONS ──

async function sbAuth(endpoint,body){
  const r=await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`,{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY},
    body:JSON.stringify(body)
  });
  return r.json();
}

async function checkAuth(){
  const stored=localStorage.getItem("ss_session");
  if(!stored)return false;
  try{
    const session=JSON.parse(stored);
    const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
      headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":`Bearer ${session.access_token}`}
    });
    if(r.ok){
      const u=await r.json();
      _currentUser=u;
      updateUserBadge(u);
      return true;
    }
    if(session.refresh_token){
      const ref=await sbAuth("token?grant_type=refresh_token",{refresh_token:session.refresh_token});
      if(ref.access_token){
        localStorage.setItem("ss_session",JSON.stringify(ref));
        _currentUser=ref.user;
        updateUserBadge(ref.user);
        return true;
      }
    }
  }catch(e){}
  localStorage.removeItem("ss_session");
  return false;
}

function updateUserBadge(user){
  const el=document.getElementById("user-badge");
  if(el&&user?.email){
    const name=user.user_metadata?.name||user.email.split("@")[0];
    el.textContent=name;
    el.style.display="inline-flex";
  }
}

async function doLogin(){
  let email=(document.getElementById("li-user")?.value||"").trim();
  const password=(document.getElementById("li-pass")?.value||"");
  const err=document.getElementById("li-err");
  const btn=document.getElementById("li-btn");
  err.classList.remove("show");

  if(!email||!password){
    err.textContent="Please enter your username and password.";
    err.classList.add("show");return;
  }

  btn.textContent="Signing in…";btn.disabled=true;

  try{
    // If input doesn't look like an email, resolve username to email
    if(!email.includes("@")){
      const rpcRes=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_email_by_username`,{
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY,"Authorization":`Bearer ${SUPABASE_ANON_KEY}`},
        body:JSON.stringify({login_username:email})
      });
      const rpcData=await rpcRes.json();
      if(rpcData){email=rpcData;}
      else{
        err.textContent="Username not found.";
        err.classList.add("show");
        btn.textContent="Sign In";btn.disabled=false;return;
      }
    }

    const url=`${SUPABASE_URL}/auth/v1/token?grant_type=password`;
    const res=await fetch(url,{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY},
      body:JSON.stringify({email,password})
    });
    const data=await res.json();
    if(data.access_token){
      localStorage.setItem("ss_session",JSON.stringify(data));
      _currentUser=data.user;
      updateUserBadge(data.user);
      btn.textContent="Welcome!";
      setTimeout(()=>{
        document.getElementById("login-screen").style.display="none";
        bootApp();
      },300);
    } else {
      const msg=data.error_description||data.message||data.msg||data.error||"Incorrect email or password.";
      console.error("Login failed:",data);
      err.textContent=msg;
      err.classList.add("show");
      document.getElementById("li-pass").value="";
      document.getElementById("li-pass").focus();
      btn.textContent="Sign In";btn.disabled=false;
      const card=document.querySelector(".login-card");
      card.style.animation="none";card.offsetHeight;
      card.style.animation="shake .35s ease";
    }
  }catch(e){
    console.error("Login fetch error:",e);
    err.textContent="Connection error: "+e.message;
    err.classList.add("show");
    btn.textContent="Sign In";btn.disabled=false;
  }
}

async function doLogout(){
  clearTimeout(_idleTimer);clearTimeout(_idleWarnTimer);clearInterval(_idleCountdown);
  try{
    const stored=localStorage.getItem("ss_session");
    if(stored){
      const session=JSON.parse(stored);
      await fetch(`${SUPABASE_URL}/auth/v1/logout`,{
        method:"POST",
        headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":`Bearer ${session.access_token}`}
      });
    }
  }catch(e){}
  localStorage.removeItem("ss_session");
  location.reload();
}

// Shake animation for failed login
const shakeStyle=document.createElement("style");
shakeStyle.textContent=`@keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-5px);}80%{transform:translateX(5px);}}`;
document.head.appendChild(shakeStyle);
