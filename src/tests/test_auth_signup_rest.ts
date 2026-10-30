const url = 'https://tuhhydrwustfvrcgvodt.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1aGh5ZHJ3dXN0ZnZyY2d2b2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTg1MTYsImV4cCI6MjEwNzczNDUxNn0.pzDWFIOWID8L6RyYpIXK1h8lb-ewbfeftrs2WIIDtWY';

async function testSignUpRest() {
  const dummyEmail = `karyawan_${Date.now()}@internal.app`;
  const dummyPass = 'Karyawan123!_';
  console.log('Calling /auth/v1/signup with:', dummyEmail);

  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: dummyEmail,
      password: dummyPass,
    }),
  });

  const authData = await res.json();
  console.log('Signup status:', res.status, 'Auth user id:', authData.id || authData.user?.id || authData);

  const userId = authData.id || authData.user?.id;
  if (userId) {
    console.log('Now inserting into profiles table using auth user ID:', userId);
    const pRes = await fetch(`${url}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        id: userId,
        username: 'andi_' + Date.now().toString().slice(-4),
        full_name: 'Andi Saputra',
        role: 'dropping',
        phone: '081234567890',
        pin: '123456',
        branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        machine_prefix: 'ANDI',
        is_active: true,
        deletion_status: 'active',
        auth_provider: 'pin',
      }),
    });

    const pData = await pRes.json();
    console.log('Profiles insert status:', pRes.status, 'Data:', pData);

    if (pRes.status === 201) {
      console.log('SUCCESS! Profile registered in Supabase DB!');
    }
  }
}

testSignUpRest();

