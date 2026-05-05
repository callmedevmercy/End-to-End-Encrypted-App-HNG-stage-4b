import WebSocket from 'ws';

async function test() {
  const fetch = (await import('node-fetch')).default;
  
  // 1. Register a test user 1
  const username1 = `t1_${Math.random().toString(36).substring(7)}`;
  const res1 = await fetch('https://whisperbox.koyeb.app/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: username1, display_name: 'U1', password: 'Password123!',
      public_key: 'pub', wrapped_private_key: 'priv', pbkdf2_salt: 'salt'
    })
  });
  const data1 = await res1.json();
  const token1 = data1.access_token;
  const id1 = data1.user.id;

  // 2. Register a test user 2
  const username2 = `t2_${Math.random().toString(36).substring(7)}`;
  const res2 = await fetch('https://whisperbox.koyeb.app/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: username2, display_name: 'U2', password: 'Password123!',
      public_key: 'pub', wrapped_private_key: 'priv', pbkdf2_salt: 'salt'
    })
  });
  const data2 = await res2.json();
  const token2 = data2.access_token;
  const id2 = data2.user.id;
  
  // Connect U2 to WS
  const ws2 = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${token2}`);
  ws2.on('message', (msg) => console.log('U2 received:', msg.toString()));
  
  await new Promise(r => ws2.on('open', r));

  // Connect U1 to WS
  const ws1 = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${token1}`);
  await new Promise(r => ws1.on('open', r));

  console.log('Sending custom typing event from U1 to U2');
  ws1.send(JSON.stringify({
    event: 'typing.start',
    data: {
      to: id2
    }
  }));

  setTimeout(() => {
    ws1.close();
    ws2.close();
  }, 2000);
}

test().catch(console.error);
