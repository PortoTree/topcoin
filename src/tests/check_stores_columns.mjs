const url = 'https://tuhhydrwustfvrcgvodt.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1aGh5ZHJ3dXN0ZnZyY2d2b2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTg1MTYsImV4cCI6MjEwNzczNDUxNn0.pzDWFIOWID8L6RyYpIXK1h8lb-ewbfeftrs2WIIDtWY';

async function checkStores() {
  const res = await fetch(`${url}/rest/v1/stores?limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const data = await res.json();
  if (Array.isArray(data) && data[0]) {
    console.log('Stores table columns:', Object.keys(data[0]));
  } else {
    console.log('Stores response:', data);
  }
}

checkStores();
