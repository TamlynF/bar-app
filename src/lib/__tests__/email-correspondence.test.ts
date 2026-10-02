import { describe, expect, it } from "vitest";
import {
  bareAddress,
  correspondenceReplyAddress,
  htmlToPlainText,
  idRangeForRef,
  parseCorrespondenceAddress,
  plainReplyHtml,
  replySubject,
  safeAttachmentName,
  senderDisplayName,
  splitQuotedReply,
  withDisplayName,
} from "@/lib/email/correspondence";

const DOMAIN = "reply.example.co.uk";
const ID = "347ce8f7-1234-4abc-9def-0123456789ab";

describe("correspondence addresses", () => {
  it("builds a short reply address from the booking reference", () => {
    expect(correspondenceReplyAddress({ kind: "band", id: ID }, DOMAIN)).toBe(`band-347ce8f7@${DOMAIN}`);
    expect(correspondenceReplyAddress({ kind: "act", id: ID.toUpperCase() }, DOMAIN)).toBe(`act-347ce8f7@${DOMAIN}`);
  });

  it("parses short references and the full ids sent before them", () => {
    expect(parseCorrespondenceAddress([`band-347CE8F7@${DOMAIN}`], DOMAIN)).toEqual({ kind: "band", ref: "347ce8f7" });
    expect(parseCorrespondenceAddress([`act-${ID}@${DOMAIN}`], DOMAIN)).toEqual({ kind: "act", ref: ID });
  });

  it("turns a reference into an inclusive id range", () => {
    expect(idRangeForRef("347ce8f7")).toEqual([
      "347ce8f7-0000-0000-0000-000000000000",
      "347ce8f7-ffff-ffff-ffff-ffffffffffff",
    ]);
    expect(idRangeForRef(ID)).toEqual([ID, ID]);
  });

  it("adds the sender's display name to the reply-to", () => {
    const name = senderDisplayName("Don Fenticas <admin@example.co.uk>");
    expect(name).toBe("Don Fenticas");
    expect(withDisplayName(`band-347ce8f7@${DOMAIN}`, name)).toBe(`"Don Fenticas" <band-347ce8f7@${DOMAIN}>`);
    expect(withDisplayName("a@b.com", "")).toBe("a@b.com");
    expect(senderDisplayName("admin@example.co.uk")).toBe("");
  });

  it("has no reply address without a domain", () => {
    expect(correspondenceReplyAddress({ kind: "band", id: ID }, "")).toBeNull();
  });

  it("finds the target among the recipients, ignoring display names and case", () => {
    expect(
      parseCorrespondenceAddress(["someone@else.com", `Don Fenticas <BAND-${ID.toUpperCase()}@Reply.Example.co.uk>`], DOMAIN)
    ).toEqual({ kind: "band", ref: ID });
  });

  it("ignores addresses on another domain or with a malformed id", () => {
    expect(parseCorrespondenceAddress([`band-${ID}@example.co.uk`], DOMAIN)).toBeNull();
    expect(parseCorrespondenceAddress([`band-123@${DOMAIN}`], DOMAIN)).toBeNull();
    expect(parseCorrespondenceAddress([`band-347ce8f7x@${DOMAIN}`], DOMAIN)).toBeNull();
  });

  it("strips display names from addresses", () => {
    expect(bareAddress('"The Hens" <Hens@Band.com>')).toBe("hens@band.com");
    expect(bareAddress(" hens@band.com ")).toBe("hens@band.com");
  });
});

describe("htmlToPlainText", () => {
  it("keeps paragraph and line breaks and drops markup", () => {
    expect(htmlToPlainText("<style>p{}</style><p>Hi there,</p><p>Sounds <b>great</b>!<br>See you</p>")).toBe(
      "Hi there,\nSounds great!\nSee you"
    );
  });

  it("decodes entities", () => {
    expect(htmlToPlainText("<div>Fee &pound;300 &amp; drinks&nbsp;&#8211; ok?</div>")).toBe("Fee £300 & drinks – ok?");
  });
});

describe("splitQuotedReply", () => {
  it("separates the reply from a Gmail-style quote", () => {
    const text = "Yes we can do that date!\n\nOn Fri, 2 Oct 2026 at 10:00, Don Fenticas <a@b.com> wrote:\n> Offer details";
    expect(splitQuotedReply(text)).toEqual({
      body: "Yes we can do that date!",
      quoted: "On Fri, 2 Oct 2026 at 10:00, Don Fenticas <a@b.com> wrote:\n> Offer details",
    });
  });

  it("handles a quote header wrapped over two lines", () => {
    const text = "Thanks\nOn Fri, 2 Oct 2026 at 10:00, Don Fenticas\n<a@b.com> wrote:\n> hi";
    expect(splitQuotedReply(text).body).toBe("Thanks");
  });

  it("cuts at an Outlook header", () => {
    expect(splitQuotedReply("Confirmed.\r\n\r\nFrom: Don Fenticas\r\nSent: Friday").body).toBe("Confirmed.");
  });

  it("keeps the whole message when nothing is quoted", () => {
    expect(splitQuotedReply("  Just one line  ")).toEqual({ body: "Just one line", quoted: "" });
  });
});

describe("replySubject", () => {
  it("prefixes Re: once", () => {
    expect(replySubject("Your offer")).toBe("Re: Your offer");
    expect(replySubject("RE: Your offer")).toBe("RE: Your offer");
    expect(replySubject("  ")).toBe("Message from Don Fenticas");
  });
});

describe("plainReplyHtml", () => {
  it("escapes the body and keeps paragraphs", () => {
    const html = plainReplyHtml("Hi <b>Hens</b>\nline two\n\nThanks");
    expect(html).toContain("Hi &lt;b&gt;Hens&lt;/b&gt;<br>line two</p>");
    expect(html).toContain(">Thanks</p>");
  });
});

describe("safeAttachmentName", () => {
  it("removes path and control characters and falls back when empty", () => {
    expect(safeAttachmentName("../rider:v2.pdf", "file")).toBe(".._rider_v2.pdf");
    expect(safeAttachmentName(null, "attachment-1")).toBe("attachment-1");
  });
});
