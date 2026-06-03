// ── INVENTORY.JS ──────────────────────────────────────────
// Back Shop Inventory — reads/writes the shared `inventory_items` and
// `inventory_categories` tables in Supabase.

let INV={items:[],categories:[],filter:"all",statusFilter:"all",search:""};

async function loadInventoryData(){
  try{
    const[items,cats]=await Promise.all([
      sbF("GET","inventory_items?order=item_name"),
      sbF("GET","inventory_categories?is_active=eq.true&order=sort_order")
    ]);
    INV.items=items||[];
    INV.categories=cats||[];
  }catch(e){console.error("Load inventory failed:",e);toast("Failed to load inventory","error");}
}

async function initInventoryPage(){
  await loadInventoryData();
  renderInventoryPage();
}

function renderInventoryPage(){
  const root=document.querySelector(".card");
  if(!root)return;
  let h=`<div class="si-header">
    <div><div class="si-title">Back Shop Inventory</div></div>
    <div class="si-actions">
      <button class="si-action-btn" onclick="openAddInventoryItem()">+ Add Item</button>
      <button class="si-action-btn secondary" onclick="openManageCategories()">⚙ Manage Categories</button>
      <button class="si-action-btn secondary" onclick="window.print()">🖨 Print</button>
    </div>
  </div>
  <div class="si-filter-bar">
    <input type="text" class="si-filter-input" placeholder="Search item…" id="inv-search" oninput="INV.search=this.value;filterInventory()">
    <select class="si-filter-select" onchange="INV.filter=this.value;filterInventory()">
      <option value="all">All Categories</option>
      ${INV.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}
    </select>
    <select class="si-filter-select" onchange="INV.statusFilter=this.value;filterInventory()">
      <option value="all">All Status</option>
      <option value="in_stock">In Stock</option>
      <option value="low">Low Stock</option>
      <option value="out_of_stock">Out of Stock</option>
      <option value="ordered">Ordered</option>
      <option value="needs_reorder">Needs Reorder</option>
    </select>
  </div>
  <div style="padding:0 0 14px 0;overflow-x:auto;">`;

  let filtered=INV.items.filter(item=>{
    if(INV.search&&!item.item_name.toLowerCase().includes(INV.search.toLowerCase()))return false;
    if(INV.filter!=="all"&&item.category_id!==INV.filter)return false;
    if(INV.statusFilter!=="all"){
      if(INV.statusFilter==="needs_reorder"){if(item.current_stock>item.min_threshold)return false;}
      else if(INV.statusFilter!==item.status)return false;
    }
    return true;
  });

  if(!filtered.length){
    h+=`<div style="padding:24px;"><div class="si-empty"><div class="si-empty-icon">📦</div><div class="si-empty-text">No items found</div><div class="si-empty-sub">Track tools, parts, and supplies</div></div></div>`;
  }else{
    h+=`<div class="inv-grid">`;
    filtered.forEach(item=>{
      const cat=INV.categories.find(c=>c.id===item.category_id);
      const statusClass=`status-badge ${item.status}`;
      const priceStr=item.price?`$${Number(item.price).toFixed(2)}`:"";
      h+=`<div class="inv-card-v2">
        <div class="inv-card-img">${item.image_url?`<img src="${esc(item.image_url)}" alt="${esc(item.item_name)}">`:`<span class="inv-card-img-ph">📦</span>`}</div>
        <div class="inv-card-body">
          <div class="inv-card-top">
            <div class="inv-card-name">${esc(item.item_name)}</div>
            ${item.product_number?`<div class="inv-card-prodnum">#${esc(item.product_number)}</div>`:""}
            <span class="service-badge svc-color-${INV.categories.findIndex(c=>c.id===item.category_id)%8}">${cat?esc(cat.name):"?"}</span>
          </div>
          <div class="inv-card-meta">
            <div class="inv-card-stock">
              <span class="inv-card-stock-num">${item.current_stock}</span>
              <span class="inv-card-stock-unit">${esc(item.unit)}</span>
              <span style="color:var(--fg-muted);font-size:11px;">min ${item.min_threshold}</span>
            </div>
            <span class="${statusClass}">${item.status.replace(/_/g," ").toUpperCase()}</span>
          </div>
          ${priceStr?`<div class="inv-card-price-row">
            <span class="inv-card-price">${priceStr}</span>
          </div>`:""}
          ${item.notes?`<div class="inv-card-notes">${esc(item.notes)}</div>`:""}
          <div class="inv-card-actions">
            <div class="inv-card-adjust">
              <button class="stock-btn" onclick="adjustInventory('${item.id}',-1)">−</button>
              <button class="stock-btn" onclick="adjustInventory('${item.id}',1)">+</button>
              ${item.status==="ordered"?`<button class="stock-btn" onclick="restockItem('${item.id}')">Restocked</button>`:`<button class="stock-btn" onclick="markOrdered('${item.id}')">Mark Ordered</button>`}
            </div>
            <div class="inv-card-edit">
              <button class="loc-action-btn" onclick="editInventoryItem('${item.id}')">Edit</button>
              <button class="loc-action-btn delete" onclick="if(confirm('Delete this item?'))deleteInventoryItem('${item.id}')">Delete</button>
            </div>
          </div>
        </div>
      </div>`;
    });
    h+=`</div>`;
  }

  h+=`</div></div>`;
  root.innerHTML=h;
}

function filterInventory(){renderInventoryPage();}

async function adjustInventory(itemId,delta){
  const item=INV.items.find(i=>i.id===itemId);
  if(!item)return;
  const newCount=Math.max(0,item.current_stock+delta);
  let newStatus=item.status;
  if(newCount===0)newStatus="out_of_stock";
  else if(newCount<=item.min_threshold)newStatus="low";
  else if(newStatus==="low"||newStatus==="out_of_stock")newStatus="in_stock";
  try{
    await sbF("PATCH",`inventory_items?id=eq.${itemId}`,{current_stock:newCount,status:newStatus});
    item.current_stock=newCount;
    item.status=newStatus;
    renderInventoryPage();
  }catch(e){toast("Failed to update stock","error");console.error(e);}
}

async function markOrdered(itemId){
  try{
    await sbF("PATCH",`inventory_items?id=eq.${itemId}`,{status:"ordered"});
    const item=INV.items.find(i=>i.id===itemId);
    if(item)item.status="ordered";
    renderInventoryPage();
  }catch(e){toast("Failed to mark as ordered","error");console.error(e);}
}

async function restockItem(itemId){
  try{
    await sbF("PATCH",`inventory_items?id=eq.${itemId}`,{status:"in_stock"});
    const item=INV.items.find(i=>i.id===itemId);
    if(item)item.status="in_stock";
    renderInventoryPage();
  }catch(e){toast("Failed to mark as restocked","error");console.error(e);}
}

function openAddInventoryItem(){
  const html=`<div style="flex-direction:column;">
    <h3 style="margin-bottom:14px;">Add Inventory Item</h3>
    <div class="si-form-group">
      <label class="si-form-label">Item Name</label>
      <input type="text" class="si-form-input" id="inv-name" placeholder="e.g., Mothers Protectant">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Product # <span style="font-weight:400;color:var(--fg-muted)">(manufacturer part number)</span></label>
      <input type="text" class="si-form-input" id="inv-prodnum" placeholder="e.g., 05302">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Category</label>
      <select class="si-form-select" id="inv-cat">
        <option value="">Select category</option>
        ${INV.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}
      </select>
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Current Stock</label>
      <input type="number" class="si-form-input" id="inv-stock" placeholder="0" value="0">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Min Threshold</label>
      <input type="number" class="si-form-input" id="inv-min" placeholder="5" value="5">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Unit</label>
      <input type="text" class="si-form-input" id="inv-unit" placeholder="e.g., gallon, box" value="unit">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Price <span style="font-weight:400;color:var(--fg-muted)">(optional)</span></label>
      <input type="number" class="si-form-input" id="inv-price" placeholder="0.00" step="0.01" min="0">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Image URL (optional)</label>
      <input type="text" class="si-form-input" id="inv-img" placeholder="https://…">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Notes</label>
      <textarea class="si-form-textarea" id="inv-notes" placeholder="Optional notes…"></textarea>
    </div>
    <div class="si-modal-actions">
      <button class="modal-done" onclick="saveInventoryItem()">Save Item</button>
      <button class="modal-cancel" onclick="closeModal()">Cancel</button>
    </div>
  </div>`;
  openModal(html,"480px");
}

async function saveInventoryItem(){
  const name=(document.getElementById("inv-name")?.value||"").trim();
  const prodNum=(document.getElementById("inv-prodnum")?.value||"").trim();
  const catId=document.getElementById("inv-cat")?.value||null;
  const stock=parseInt(document.getElementById("inv-stock")?.value||0);
  const min=parseInt(document.getElementById("inv-min")?.value||5);
  const unit=(document.getElementById("inv-unit")?.value||"unit").trim();
  const price=parseFloat(document.getElementById("inv-price")?.value)||null;
  const img=(document.getElementById("inv-img")?.value||"").trim();
  const notes=(document.getElementById("inv-notes")?.value||"").trim();
  if(!name||!catId){toast("Please fill in required fields","error");return;}
  try{
    const status=stock===0?"out_of_stock":stock<=min?"low":"in_stock";
    await sbF("POST","inventory_items",{item_name:name,product_number:prodNum,category_id:catId,current_stock:stock,min_threshold:min,unit,image_url:img||null,status,notes,price});
    toast("Item added");
    closeModal();
    await loadInventoryData();
    renderInventoryPage();
  }catch(e){toast("Failed to save item","error");console.error(e);}
}

function editInventoryItem(itemId){
  const item=INV.items.find(i=>i.id===itemId);
  if(!item)return;
  const html=`<div style="flex-direction:column;">
    <h3 style="margin-bottom:14px;">Edit Inventory Item</h3>
    <div class="si-form-group">
      <label class="si-form-label">Item Name</label>
      <input type="text" class="si-form-input" id="inv-name" value="${esc(item.item_name)}">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Product # <span style="font-weight:400;color:var(--fg-muted)">(manufacturer part number)</span></label>
      <input type="text" class="si-form-input" id="inv-prodnum" value="${esc(item.product_number||"")}">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Category</label>
      <select class="si-form-select" id="inv-cat">
        <option value="">Select category</option>
        ${INV.categories.map(c=>`<option value="${c.id}" ${c.id===item.category_id?"selected":""}>${esc(c.name)}</option>`).join("")}
      </select>
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Current Stock</label>
      <input type="number" class="si-form-input" id="inv-stock" value="${item.current_stock}">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Min Threshold</label>
      <input type="number" class="si-form-input" id="inv-min" value="${item.min_threshold}">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Unit</label>
      <input type="text" class="si-form-input" id="inv-unit" value="${esc(item.unit)}">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Price</label>
      <input type="number" class="si-form-input" id="inv-price" value="${item.price||""}" step="0.01" min="0">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Image URL</label>
      <input type="text" class="si-form-input" id="inv-img" value="${item.image_url?esc(item.image_url):""}">
    </div>
    <div class="si-form-group">
      <label class="si-form-label">Notes</label>
      <textarea class="si-form-textarea" id="inv-notes">${esc(item.notes||"")}</textarea>
    </div>
    <div class="si-modal-actions">
      <button class="modal-done" onclick="updateInventoryItem('${itemId}')">Update</button>
      <button class="modal-cancel" onclick="closeModal()">Cancel</button>
    </div>
  </div>`;
  openModal(html,"480px");
}

async function updateInventoryItem(itemId){
  const name=(document.getElementById("inv-name")?.value||"").trim();
  const prodNum=(document.getElementById("inv-prodnum")?.value||"").trim();
  const catId=document.getElementById("inv-cat")?.value||null;
  const stock=parseInt(document.getElementById("inv-stock")?.value||0);
  const min=parseInt(document.getElementById("inv-min")?.value||5);
  const unit=(document.getElementById("inv-unit")?.value||"unit").trim();
  const price=parseFloat(document.getElementById("inv-price")?.value)||null;
  const img=(document.getElementById("inv-img")?.value||"").trim();
  const notes=(document.getElementById("inv-notes")?.value||"").trim();
  if(!name||!catId){toast("Please fill in required fields","error");return;}
  try{
    const status=stock===0?"out_of_stock":stock<=min?"low":"in_stock";
    await sbF("PATCH",`inventory_items?id=eq.${itemId}`,{item_name:name,product_number:prodNum,category_id:catId,current_stock:stock,min_threshold:min,unit,image_url:img||null,notes,status,price});
    toast("Item updated");
    closeModal();
    await loadInventoryData();
    renderInventoryPage();
  }catch(e){toast("Failed to update item","error");console.error(e);}
}

async function deleteInventoryItem(itemId){
  try{
    await sbF("DELETE",`inventory_items?id=eq.${itemId}`);
    toast("Item deleted");
    await loadInventoryData();
    renderInventoryPage();
  }catch(e){toast("Failed to delete item","error");console.error(e);}
}

function openManageCategories(){
  const html=`<div style="flex-direction:column;">
    <h3 style="margin-bottom:14px;">Inventory Categories</h3>
    <div id="cat-list" style="margin-bottom:14px;">
      ${INV.categories.map(c=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg-deep);border-radius:6px;margin-bottom:6px;">
        <span>${esc(c.name)}</span>
        <button class="loc-action-btn delete" onclick="deleteCategory('${c.id}')">Remove</button>
      </div>`).join("")}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:14px;">
      <input type="text" class="si-form-input" id="new-cat" placeholder="New category…" style="margin-bottom:8px;">
      <button class="si-action-btn" onclick="addCategory()" style="width:100%;">Add Category</button>
    </div>
    <button class="modal-cancel" onclick="closeModal()" style="margin-top:14px;width:100%;">Done</button>
  </div>`;
  openModal(html,"480px");
}

async function addCategory(){
  const input=document.getElementById("new-cat");
  const name=(input?.value||"").trim();
  if(!name){toast("Enter a category name","error");return;}
  try{
    const maxSort=Math.max(...INV.categories.map(c=>c.sort_order||0),0);
    await sbF("POST","inventory_categories",{name,sort_order:maxSort+1,is_active:true});
    toast("Category added");
    await loadInventoryData();
    openManageCategories();
  }catch(e){toast("Failed to add category","error");console.error(e);}
}

async function deleteCategory(catId){
  try{
    await sbF("PATCH",`inventory_categories?id=eq.${catId}`,{is_active:false});
    toast("Category removed");
    await loadInventoryData();
    openManageCategories();
  }catch(e){toast("Failed to remove category","error");console.error(e);}
}
