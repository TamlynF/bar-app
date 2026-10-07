import { afterEach, describe, expect, it } from "vitest";
import {
  readTwilioEnv,
  readWhatsappEnv,
  smsAlertsEnabled,
  twilioSignature,
  verifyTwilioSignature,
  whatsappAlertsEnabled,
} from "../twilio";

const KEYS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID", "TWILIO_SMS_FROM"] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("smsAlertsEnabled", () => {
  it("is off until every Twilio key is set", () => {
    expect(smsAlertsEnabled()).toBe(false);
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    expect(smsAlertsEnabled()).toBe(false);
    process.env.TWILIO_SMS_FROM = "DonFenticas";
    expect(smsAlertsEnabled()).toBe(true);
    expect(readTwilioEnv()).toEqual({
      accountSid: "AC123",
      authToken: "secret",
      verifyServiceSid: "VA123",
      from: "DonFenticas",
    });
  });
});

describe("twilioSignature", () => {
  /* Worked example from Twilio's "validating requests" documentation. */
  const token = "12345";
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = {
    CallSid: "CA1234567890ABCDE",
    Caller: "+12349013030",
    Digits: "1234",
    From: "+12349013030",
    To: "+18005551212",
  };

  it("matches the documented signature", () => {
    expect(twilioSignature(token, url, params)).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
  });

  it("accepts the right signature and rejects a tampered one", () => {
    expect(verifyTwilioSignature(token, url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=")).toBe(true);
    expect(verifyTwilioSignature(token, url, { ...params, Digits: "9999" }, "0/KCTR6DLpKmkAf8muzZqo1nDgQ=")).toBe(false);
    expect(verifyTwilioSignature(token, url, params, "short")).toBe(false);
  });
});

describe("whatsappAlertsEnabled", () => {
  it("needs the base Twilio keys plus a WhatsApp sender", () => {
    process.env.TWILIO_WHATSAPP_FROM = "+14155238886";
    expect(whatsappAlertsEnabled()).toBe(false);
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    process.env.TWILIO_SMS_FROM = "DonFenticas";
    expect(whatsappAlertsEnabled()).toBe(true);
    expect(readWhatsappEnv()).toEqual({ from: "whatsapp:+14155238886", templateSid: null, sandboxJoin: null });
    process.env.TWILIO_WHATSAPP_FROM = "MG123";
    expect(readWhatsappEnv()?.from).toBe("MG123");
    delete process.env.TWILIO_WHATSAPP_FROM;
  });
});
