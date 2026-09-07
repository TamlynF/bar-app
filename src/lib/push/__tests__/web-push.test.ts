import { describe, expect, it } from "vitest";
import {
  createDecipheriv,
  createECDH,
  createPublicKey,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  verify as cryptoVerify,
} from "node:crypto";
import {
  createVapidAuthorization,
  encryptPushPayload,
  readVapidKeys,
  type PushSubscriptionKeys,
  type VapidKeys,
} from "../web-push";

function makeVapidKeys(): VapidKeys {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" }) as { x: string; y: string; d: string };
  const publicKey = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x, "base64url"),
    Buffer.from(jwk.y, "base64url"),
  ]).toString("base64url");
  return { publicKey, privateKey: jwk.d, subject: "mailto:test@example.com" };
}

function makeSubscription() {
  const userAgent = createECDH("prime256v1");
  userAgent.generateKeys();
  const authSecret = randomBytes(16);
  const subscription: PushSubscriptionKeys = {
    endpoint: "https://push.example.com/send/abc123",
    p256dh: userAgent.getPublicKey().toString("base64url"),
    auth: authSecret.toString("base64url"),
  };
  return { userAgent, authSecret, subscription };
}

function decryptAsUserAgent(body: Buffer, userAgent: ReturnType<typeof createECDH>, authSecret: Buffer): Buffer {
  const salt = body.subarray(0, 16);
  const recordSize = body.readUInt32BE(16);
  const idLength = body[20];
  const serverPublic = body.subarray(21, 21 + idLength);
  const ciphertext = body.subarray(21 + idLength);
  expect(recordSize).toBe(4096);
  expect(idLength).toBe(65);

  const sharedSecret = userAgent.computeSecret(serverPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), userAgent.getPublicKey(), serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const record = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  expect(record[record.length - 1]).toBe(2);
  return record.subarray(0, record.length - 1);
}

describe("encryptPushPayload", () => {
  it("produces an aes128gcm body the subscriber can decrypt", () => {
    const { userAgent, authSecret, subscription } = makeSubscription();
    const payload = Buffer.from(JSON.stringify({ title: "Market Night", body: "Guinness down to £4.20" }));

    const body = encryptPushPayload(payload, subscription);
    const plaintext = decryptAsUserAgent(body, userAgent, authSecret);

    expect(plaintext.toString("utf8")).toBe(payload.toString("utf8"));
  });

  it("uses a fresh salt and key pair per message", () => {
    const { subscription } = makeSubscription();
    const payload = Buffer.from("same");
    const first = encryptPushPayload(payload, subscription);
    const second = encryptPushPayload(payload, subscription);
    expect(first.subarray(0, 16).equals(second.subarray(0, 16))).toBe(false);
    expect(first.subarray(21, 86).equals(second.subarray(21, 86))).toBe(false);
  });

  it("rejects malformed subscription keys", () => {
    const { subscription } = makeSubscription();
    expect(() => encryptPushPayload(Buffer.from("x"), { ...subscription, auth: "short" })).toThrow(/auth secret/);
    expect(() => encryptPushPayload(Buffer.from("x"), { ...subscription, p256dh: "AAAA" })).toThrow(/p256dh/);
  });
});

describe("createVapidAuthorization", () => {
  it("signs a JWT for the push service origin that verifies with the public key", () => {
    const keys = makeVapidKeys();
    const now = Date.UTC(2026, 8, 7, 20, 0, 0);
    const header = createVapidAuthorization("https://web.push.apple.com/QWxhZGRpbg", keys, now);

    const match = /^vapid t=([^,]+), k=(.+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, token, advertisedKey] = match!;
    expect(advertisedKey).toBe(keys.publicKey);

    const [encodedHeader, encodedClaims, encodedSignature] = token.split(".");
    expect(JSON.parse(Buffer.from(encodedHeader, "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString());
    expect(claims.aud).toBe("https://web.push.apple.com");
    expect(claims.sub).toBe(keys.subject);
    expect(claims.exp).toBe(Math.floor(now / 1000) + 12 * 60 * 60);

    const publicKeyBytes = Buffer.from(keys.publicKey, "base64url");
    const publicKey = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: publicKeyBytes.subarray(1, 33).toString("base64url"),
        y: publicKeyBytes.subarray(33, 65).toString("base64url"),
      },
      format: "jwk",
    });
    const verified = cryptoVerify(
      "sha256",
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(encodedSignature, "base64url")
    );
    expect(verified).toBe(true);
  });
});

describe("readVapidKeys", () => {
  it("returns null until both keys are configured", () => {
    expect(readVapidKeys({})).toBeNull();
    expect(readVapidKeys({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub" })).toBeNull();
  });

  it("falls back to the site URL as the subject", () => {
    const keys = readVapidKeys({
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub",
      VAPID_PRIVATE_KEY: "priv",
      NEXT_PUBLIC_SITE_URL: "https://example.test",
    });
    expect(keys).toEqual({ publicKey: "pub", privateKey: "priv", subject: "https://example.test" });
  });
});
