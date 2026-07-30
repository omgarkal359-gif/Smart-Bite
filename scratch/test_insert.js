const url = "https://hmdewtmtxgfyunyypcon.supabase.co/rest/v1/orders";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZGV3dG10eGdmeXVueXlwY29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDQ2NDQsImV4cCI6MjA5NTk4MDY0NH0.sy6oeke8atqEHPnkWKMZPK9ggbJp8J3HF6G-GFsJRGg";

async function testInsert() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({})
  });
  
  const body = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", body);
}
testInsert();
