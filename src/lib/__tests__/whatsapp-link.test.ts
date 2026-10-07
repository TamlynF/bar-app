import { describe, expect, it } from "vitest";
import { normaliseWhatsappLink, whatsappLinkKind } from "../whatsapp-link";

describe("normaliseWhatsappLink", () => {
  it("accepts group invite links however they were pasted", () => {
    expect(normaliseWhatsappLink("https://chat.whatsapp.com/AbCdEfGh1234567")).toBe("https://chat.whatsapp.com/AbCdEfGh1234567");
    expect(normaliseWhatsappLink("chat.whatsapp.com/AbCdEfGh1234567/")).toBe("https://chat.whatsapp.com/AbCdEfGh1234567");
    expect(normaliseWhatsappLink(" http://www.chat.whatsapp.com/invite/AbCdEfGh1234567?utm=x ")).toBe(
      "https://chat.whatsapp.com/AbCdEfGh1234567"
    );
  });

  it("accepts channel links", () => {
    expect(normaliseWhatsappLink("https://www.whatsapp.com/channel/0029VaAbCdEf1234")).toBe(
      "https://whatsapp.com/channel/0029VaAbCdEf1234"
    );
  });

  it("rejects anything that isn't a WhatsApp invite", () => {
    expect(normaliseWhatsappLink("https://instagram.com/donfenticas")).toBeNull();
    expect(normaliseWhatsappLink("https://wa.me/447700900123")).toBeNull();
    expect(normaliseWhatsappLink("https://chat.whatsapp.com/")).toBeNull();
    expect(normaliseWhatsappLink("https://chat.whatsapp.com.evil.com/AbCdEfGh1234567")).toBeNull();
    expect(normaliseWhatsappLink("")).toBeNull();
    expect(normaliseWhatsappLink(null)).toBeNull();
  });
});

describe("whatsappLinkKind", () => {
  it("tells groups and channels apart", () => {
    expect(whatsappLinkKind("https://chat.whatsapp.com/AbCdEfGh1234567")).toBe("group");
    expect(whatsappLinkKind("https://whatsapp.com/channel/0029VaAbCdEf1234")).toBe("channel");
  });
});
