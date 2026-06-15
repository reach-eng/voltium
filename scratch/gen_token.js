const crypto = require('crypto');
const SECRET = 'SKRZjEfvWNE2-YLmuDphqZtWi6TW8sV4Uyp6FzQbxOOp-hQHzf6kRsjYogLUO57E';

function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');

  return `${header}.${payloadStr}.${signature}`;
}

const token = createToken({
  riderId: 'admin-1',
  riderDbId: 'admin-1',
  phone: '0000000000',
  role: 'admin',
  adminRole: 'SUPER_ADMIN',
  adminId: 'admin-1',
});

console.log(token);
