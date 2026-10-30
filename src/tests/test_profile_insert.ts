const url = 'https://tuhhydrwustfvrcgvodt.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1aGh5ZHJ3dXN0ZnZyY2d2b2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTg1MTYsImV4cCI6MjEwNzczNDUxNn0.pzDWFIOWID8L6RyYpIXK1h8lb-ewbfeftrs2WIIDtWY';

async function testInsert() {
  const testId = crypto.randomUUID();
  console.log('Testing insert with crypto.randomUUID():', testId);
  const res = await fetch(`${url}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: testId,
      username: 'test_karyawan_' + Date.now(),
      full_name: 'Test Karyawan',
      role: 'dropping',
      phone: '081299999999',
      pin: '123456',
      branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      machine_prefix: 'TEST',
      is_active: true,
      deletion_status: 'active',
      auth_provider: 'pin',
    }),
  });

  const data = await res.json();
  console.log('Insert status:', res.status, 'Response:', data);

  if (res.status === 201 && Array.isArray(data) && data[0]?.id) {
    console.log('Cleaning up test user...');
    await fetch(`${url}/rest/v1/profiles?id=eq.${data[0].id}`, {
      method: 'DELETE',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    console.log('Cleanup complete!');
  }
}

testInsert();

