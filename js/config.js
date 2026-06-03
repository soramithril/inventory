// ── CONFIG.JS ──────────────────────────────────────────
// JWG Back Shop Inventory — shares the same Supabase project as the
// main Jeff White Group Staff Scheduler, so inventory data is live-synced
// between both apps.

const SUPABASE_URL = "https://ghfxpftkdvlaygueyhqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoZnhwZnRrZHZsYXlndWV5aHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTM0MjEsImV4cCI6MjA4ODY2OTQyMX0.arx7rS1hfiyixrxprwY05eWvtgRdDmml66KXKxjhspI";
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// HTML-escape helper used throughout the inventory views.
function esc(s){const d=document.createElement("div");d.textContent=s==null?"":s;return d.innerHTML;}
