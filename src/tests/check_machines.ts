const url = 'https://tuhhydrwustfvrcgvodt.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1aGh5ZHJ3dXN0ZnZyY2d2b2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTg1MTYsImV4cCI6MjEwNzczNDUxNn0.pzDWFIOWID8L6RyYpIXK1h8lb-ewbfeftrs2WIIDtWY';

async function query(endpoint: string) {
  const res = await fetch(`${url}/rest/v1/${endpoint}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  return { status: res.status, data: await res.json() };
}

async function run() {
  console.log('Testing explicit FK fk_machines_current_store:');
  const join = await query('machines?select=*,store:stores!fk_machines_current_store(name,address)');
  console.log('Status:', join.status);
  console.log('Join machines count:', join.data?.length);
  if (Array.isArray(join.data)) {
    console.log('Last 3 machines:', join.data.slice(-3));
  } else {
    console.log('Error:', join.data);
  }
}

run();
