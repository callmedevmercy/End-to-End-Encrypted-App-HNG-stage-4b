import WebSocket from 'ws';
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
  const token2 = data2.access_token;
  const id2 = data2.user.id;

  const ws2 = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${token2}`);
  ws2.on('message', (msg) => console.log('U2 received:', msg.toString()));
  await new Promise(r => ws2.on('open', r));

  console.log('Sending message via REST POST /messages');
  await fetch('https://whisperbox.koyeb.app/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
    body: JSON.stringify({
      to: id2,
      payload: { ciphertext: 'c', iv: 'i', encryptedKey: 'ek', encryptedKeyForSelf: 'eks' }
    })
  });

  setTimeout(() => {
    ws2.close();
  }, 2000);
}
test().catch(console.error);
