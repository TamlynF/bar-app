// Prints a fresh VAPID key pair for Web Push. Run once, paste the two lines
// into .env.local (and the Vercel project env), never commit them:
//   node scripts/generate-vapid-keys.mjs
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]).toString("base64url");

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
console.log("");
console.log("Replace the VAPID_SUBJECT address with a monitored inbox (or use your https:// site URL).");
console.log("Paste only the three KEY=value lines - no trailing comments, push services reject them.");
