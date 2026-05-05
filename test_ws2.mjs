import WebSocket from 'ws';
import fetch from 'node-fetch';

async function test() {
  const u1 = `t1_${Math.random().toString(36).substring(7)}`;
  const res1 = await fetch('https://whisperbox.koyeb.app/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: u1, display_name: 'U1', password: 'Password123!',
      public_key: 'pub', wrapped_private_key: 'priv', pbkdf2_salt: 'salt'
    })
  });
  const data1 = await res1.json();
  const token1 = data1.access_token;
  const id1 = data1.user.id;

  const u2 = `t2_${Math.random().toString(36).substring(7)}`;
  const res2 = await fetch('https://whisperbox.koyeb.app/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: u2, display_name: 'U2', password: 'Password123!',
      public_key: 'pub', wrapped_private_key: 'priv', pbkdf2_salt: 'salt'
    })
  });
  const data2 = await res2.json();
  const token2 = data2.access_token;
  const id2 = data2.user.id;

  const ws2 = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${token2}`);
  ws2.on('message', (msg) => console.log('U2 received:', msg.toString()));
  await new Promise(r => ws2.on('open', r));

  const ws1 = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${token1}`);
  ws1.on('message', (msg) => console.log('U1 received:', msg.toString()));
  await new Promise(r => ws1.on('open', r));

  console.log('Sending correct message.send frame');
  ws1.send(JSON.stringify({
    event: 'message.send',
    to: id2,
    payload: { ciphertext: 'c', iv: 'i', encryptedKey: 'ek', encryptedKeyForSelf: 'eks' }
  }));

  setTimeout(() => {
    ws1.close();
    ws2.close();
  }, 2000);
}
test().catch(console.error);
