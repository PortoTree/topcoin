import { createClient } from '@supabase/supabase-js';

const url = 'https://tuhhydrwustfvrcgvodt.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1aGh5ZHJ3dXN0ZnZyY2d2b2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTg1MTYsImV4cCI6MjEwNzczNDUxNn0.pzDWFIOWID8L6RyYpIXK1h8lb-ewbfeftrs2WIIDtWY';

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function testSignUp() {
  const dummyEmail = `karyawan_${Date.now()}@internal.app`;
  const dummyPass = 'Karyawan123!_';
  console.log('Testing supabase.auth.signUp with:', dummyEmail);
  const { data, error } = await supabase.auth.signUp({
    email: dummyEmail,
    password: dummyPass,
  });

  console.log('Auth signUp result:', data.user?.id, error);

  if (data.user?.id) {
    console.log('Trying to insert to profiles with auth user id:', data.user.id);
    const { data: pData, error: pError } = await supabase.from('profiles').insert({
      id: data.user.id,
      username: 'test_' + Date.now(),
      full_name: 'Test Karyawan',
      role: 'dropping',
      phone: '081299998888',
      pin: '123456',
      branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      machine_prefix: 'TEST',
      is_active: true,
      deletion_status: 'active',
      auth_provider: 'pin',
    }).select();

    console.log('Profile insert result:', pData, pError);
  }
}

testSignUp();

