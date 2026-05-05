import fetch from 'node-fetch';

async function test() {
  const res1 = await fetch('https://whisperbox.koyeb.app/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `t1_${Date.now()}`, display_name: 'U1', password: 'Password123!', public_key: 'pub', wrapped_private_key: 'priv', pbkdf2_salt: 'salt' })
  });
  const data1 = await res1.json();
  const token1 = data1.access_token;
  
  const res2 = await fetch('https://whisperbox.koyeb.app/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `t2_${Date.now()}`, display_name: 'U2', password: 'Password123!', public_key: 'pub', wrapped_private_key: 'priv', pbkdf2_salt: 'salt' })
  });
  const data2 = await res2.json();
  const id2 = data2.user.id;

  // Post
  await fetch('https://whisperbox.koyeb.app/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
    body: JSON.stringify({
      to: id2,
      payload: { ciphertext: 'c', iv: 'i', encryptedKey: 'ek', encryptedKeyForSelf: 'eks' }
    })
  });

  // Get
  const res = await fetch(`https://whisperbox.koyeb.app/conversations/${id2}/messages`, {
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  const msgs = await res.json();
  console.log('TYPE OF PAYLOAD:', typeof msgs[0].payload);
  console.log('PAYLOAD:', msgs[0].payload);
}
test().catch(console.error);
