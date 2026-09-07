import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign as cryptoSign,
  type ECDH,
  type KeyObject,
} from "node:crypto";

/* Web Push sender built on Node's crypto - RFC 8291 payload encryption
   (aes128gcm, RFC 8188 framing) plus RFC 8292 VAPID authorization. Kept
   dependency-free on purpose; swap the transport for the `web-push` package
   if the protocol ever grows beyond this. */

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type WebPushResult = {
  ok: boolean;
  status: number;
  gone: boolean;
  body: string;
};

const RECORD_SIZE = 4096;
const VAPID_TTL_SEC = 12 * 60 * 60;
const KEY_INFO_PREFIX = Buffer.from("WebPush: info\0");
const CEK_INFO = Buffer.from("Content-Encoding: aes128gcm\0");
const NONCE_INFO = Buffer.from("Content-Encoding: nonce\0");

function toBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  return Buffer.from(bytes as Uint8Array).toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

const SUBJECT_PATTERN = /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/;

/* Push services reject the whole JWT when `sub` is not a clean mailto: or
   https: URL, so take only the first token of the configured value (a pasted
   trailing comment is the usual culprit) and fall back to the site URL. */
export function vapidSubject(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [env.VAPID_SUBJECT, env.NEXT_PUBLIC_SITE_URL];
  for (const raw of candidates) {
    const token = raw?.trim().split(/\s+/)[0];
    if (token && SUBJECT_PATTERN.test(token)) return token;
  }
  return "https://localhost";
}

export function readVapidKeys(env: NodeJS.ProcessEnv = process.env): VapidKeys | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: vapidSubject(env) };
}

function vapidPrivateKeyObject(keys: VapidKeys): KeyObject {
  const publicKey = fromBase64Url(keys.publicKey);
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error("VAPID public key must be a 65-byte uncompressed P-256 point");
  }
  return createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: toBase64Url(publicKey.subarray(1, 33)),
      y: toBase64Url(publicKey.subarray(33, 65)),
      d: keys.privateKey,
    },
    format: "jwk",
  });
}

export function createVapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  now: number = Date.now()
): string {
  const audience = new URL(endpoint).origin;
  const header = toBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = toBase64Url(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(now / 1000) + VAPID_TTL_SEC,
        sub: keys.subject,
      })
    )
  );
  const unsigned = `${header}.${claims}`;
  const signature = cryptoSign("sha256", Buffer.from(unsigned), {
    key: vapidPrivateKeyObject(keys),
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${keys.publicKey}`;
}

export type EncryptOptions = {
  salt?: Buffer;
  localKeyPair?: ECDH;
};

export function encryptPushPayload(
  plaintext: Buffer,
  subscription: PushSubscriptionKeys,
  options: EncryptOptions = {}
): Buffer {
  const userAgentPublic = fromBase64Url(subscription.p256dh);
  const authSecret = fromBase64Url(subscription.auth);
  if (userAgentPublic.length !== 65 || userAgentPublic[0] !== 4) {
    throw new Error("Subscription p256dh must be a 65-byte uncompressed P-256 point");
  }
  if (authSecret.length !== 16) {
    throw new Error("Subscription auth secret must be 16 bytes");
  }
  if (plaintext.length + 1 + 16 > RECORD_SIZE) {
    throw new Error("Push payload too large for a single record");
  }

  const local = options.localKeyPair ?? createECDH("prime256v1");
  if (!options.localKeyPair) local.generateKeys();
  const localPublic = local.getPublicKey();
  const sharedSecret = local.computeSecret(userAgentPublic);

  const keyInfo = Buffer.concat([KEY_INFO_PREFIX, userAgentPublic, localPublic]);
  const inputKeyMaterial = Buffer.from(hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));

  const salt = options.salt ?? randomBytes(16);
  const contentKey = Buffer.from(hkdfSync("sha256", inputKeyMaterial, salt, CEK_INFO, 16));
  const nonce = Buffer.from(hkdfSync("sha256", inputKeyMaterial, salt, NONCE_INFO, 12));

  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const record = Buffer.concat([plaintext, Buffer.from([2])]);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(RECORD_SIZE);
  return Buffer.concat([salt, recordSize, Buffer.from([localPublic.length]), localPublic, ciphertext]);
}

export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: unknown,
  keys: VapidKeys,
  ttlSec: number = 3600
): Promise<WebPushResult> {
  const body = encryptPushPayload(Buffer.from(JSON.stringify(payload)), subscription);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: String(ttlSec),
      Urgency: "high",
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(body.length),
      Authorization: createVapidAuthorization(subscription.endpoint, keys),
    },
    body: new Uint8Array(body),
  });
  const text = await response.text().catch(() => "");
  return {
    ok: response.ok,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
    body: text,
  };
}
