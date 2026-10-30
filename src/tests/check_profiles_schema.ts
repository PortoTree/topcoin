const url = 'https://tuhhydrwustfvrcgvodt.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1aGh5ZHJ3dXN0ZnZyY2d2b2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTg1MTYsImV4cCI6MjEwNzczNDUxNn0.pzDWFIOWID8L6RyYpIXK1h8lb-ewbfeftrs2WIIDtWY';

async function run() {
  const res = await fetch(`${url}/rest/v1/profiles?select=*&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const data = await res.json();
  console.log('Sample profile columns in database:');
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No profiles found or error:', data);
  }
}

run();

