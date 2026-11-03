// Prints the client secret for Sign in with Apple (AUTH_APPLE_SECRET).
// Apple wants a JWT signed with your .p8 key instead of a fixed secret, and it expires after at most 6 months.
//
//   npm run apple-secret -- path/to/AuthKey_XXXXXXXXXX.p8
//
// Reads APPLE_TEAM_ID, APPLE_KEY_ID and AUTH_APPLE_ID (the Services ID) from the environment or .env.local.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

try {
  process.loadEnvFile('.env.local');
} catch {
  // fine: the values can come from the shell instead
}

const keyPath = process.argv[2];
const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const clientId = process.env.AUTH_APPLE_ID;
const missing = [!keyPath && 'path to the .p8 key', !teamId && 'APPLE_TEAM_ID', !keyId && 'APPLE_KEY_ID', !clientId && 'AUTH_APPLE_ID'].filter(Boolean);
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`);
  process.exit(1);
}

const SIX_MONTHS = 180 * 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const input = `${b64({ alg: 'ES256', kid: keyId })}.${b64({ iss: teamId, iat: now, exp: now + SIX_MONTHS, aud: 'https://appleid.apple.com', sub: clientId })}`;
// JWTs use the raw r||s signature form, not DER
const signature = sign('sha256', Buffer.from(input), { key: createPrivateKey(readFileSync(keyPath)), dsaEncoding: 'ieee-p1363' });

console.log(`${input}.${signature.toString('base64url')}`);
console.error(`\nValid until ${new Date((now + SIX_MONTHS) * 1000).toDateString()}. Set it as AUTH_APPLE_SECRET and regenerate before then.`);
