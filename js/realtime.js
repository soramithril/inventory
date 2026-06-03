// ── REALTIME.JS ──────────────────────────────────────────
// Live-sync inventory across devices and with the main JWG scheduler app.
// Listens to the shared inventory_items / inventory_categories tables.

let _sbClient=null;
let _realtimeChannel=null;

function isModalOpen(){return !!document.getElementById("moverlay");}

function initRealtime(){
  if(!USE_SUPABASE||!window.supabase)return;
  try{
    _sbClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    // Inventory tables are RLS-restricted to authenticated users, so the
    // realtime connection must carry the signed-in user's token to receive
    // change events. (Kept fresh on token refresh — see refreshSession.)
    try{
      const sess=JSON.parse(localStorage.getItem("ss_session")||"{}");
      if(sess.access_token)_sbClient.realtime.setAuth(sess.access_token);
    }catch(e){}
  }catch(e){console.warn("Realtime init failed:",e);return;}

  _realtimeChannel=_sbClient.channel("inventory-sync")

    // ── Inventory Items ──
    .on("postgres_changes",{event:"*",schema:"public",table:"inventory_items"},payload=>{
      const row=payload.eventType==="DELETE"?payload.old:payload.new;
      if(!row)return;
      if(payload.eventType==="DELETE")INV.items=INV.items.filter(i=>i.id!==row.id);
      else{
        const idx=INV.items.findIndex(i=>i.id===row.id);
        if(idx>=0)INV.items[idx]={...INV.items[idx],...row};
        else INV.items.push(row);
      }
      if(!isModalOpen())renderInventoryPage();
    })

    // ── Inventory Categories ──
    .on("postgres_changes",{event:"*",schema:"public",table:"inventory_categories"},payload=>{
      const row=payload.eventType==="DELETE"?payload.old:payload.new;
      if(!row)return;
      if(payload.eventType==="DELETE")INV.categories=INV.categories.filter(c=>c.id!==row.id);
      else{
        const idx=INV.categories.findIndex(c=>c.id===row.id);
        if(idx>=0)INV.categories[idx]={...INV.categories[idx],...row};
        else INV.categories.push(row);
      }
      if(!isModalOpen())renderInventoryPage();
    })

    .subscribe(status=>{
      if(status==="SUBSCRIBED")console.log("Realtime: connected");
      else if(status==="CHANNEL_ERROR")console.warn("Realtime: channel error, will retry");
    });
}

// Re-render after modal closes to catch any changes that arrived while editing
const _origCloseModal=closeModal;
closeModal=function(){
  _origCloseModal();
  setTimeout(()=>renderInventoryPage(),50);
};
