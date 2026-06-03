// ── APP.JS ──────────────────────────────────────────
// Boot the Back Shop Inventory app.

async function bootApp(){
  document.getElementById("app").style.display="block";
  startSessionKeepAlive();
  startInactivityTimer();
  await initInventoryPage();
  initRealtime();
}

(async()=>{
  const authed=await checkAuth();
  if(authed){
    document.getElementById("login-screen").style.display="none";
    bootApp();
  } else {
    document.getElementById("login-screen").style.display="flex";
    setTimeout(()=>document.getElementById("li-user")?.focus(),100);
  }
})();
