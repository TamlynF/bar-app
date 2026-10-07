"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BOOKING_EMAILS,
  STANDARD_CHOICE,
  sanitizeBookingEmailChoices,
  type BookingEmailChoices,
  type BookingEmailSlot,
  type EmailVersion,
} from "@/lib/email/booking-email-versions";

const INHERIT = "inherit";

export interface InheritLevel {
  label: string;
  choices: unknown;
}

export function serializeBookingEmails(choices: BookingEmailChoices): string {
  return JSON.stringify(choices);
}

export function BookingEmailsPicker({
  value,
  onChange,
  versions,
  inheritFrom,
  blurb,
}: {
  value: BookingEmailChoices;
  onChange: (next: BookingEmailChoices) => void;
  versions: EmailVersion[];
  inheritFrom: InheritLevel[];
  blurb: string;
}) {
  const nameOf = (id: number) =>
    id === STANDARD_CHOICE ? "Standard" : (versions.find((v) => v.id === id)?.name ?? "Standard");

  const inherited = (slot: BookingEmailSlot) => {
    for (const level of inheritFrom) {
      const id = sanitizeBookingEmailChoices(level.choices)[slot];
      if (id !== undefined) return `${nameOf(id)} (from ${level.label})`;
    }
    return "Standard";
  };

  const choose = (slot: BookingEmailSlot, raw: string) => {
    const next = { ...value };
    if (raw === INHERIT) delete next[slot];
    else next[slot] = Number(raw);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-admin-primary" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-[13px] font-bold text-admin-ink">Booking emails</p>
          <p className="text-[12px] leading-snug text-admin-muted">
            {blurb}{" "}
            <Link href="/settings/email-templates" className="font-semibold text-admin-primary underline-offset-2 hover:underline">
              Manage versions
            </Link>
          </p>
        </div>
      </div>
      <ul className="divide-y divide-admin-line overflow-hidden rounded-2xl border border-admin-line bg-admin-card">
        {BOOKING_EMAILS.map((email) => {
          const options = versions.filter((v) => v.scenarioKey === email.key);
          const current = value[email.slot];
          return (
            <li key={email.slot} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="flex-1 text-[13px] font-semibold text-admin-ink">{email.label}</span>
              <Select
                value={current === undefined ? INHERIT : String(current)}
                onValueChange={(raw) => choose(email.slot, raw)}
              >
                <SelectTrigger
                  aria-label={`${email.label} email`}
                  className="h-11 gap-2 border border-admin-line bg-white px-3 text-left text-[13px] font-semibold text-admin-ink focus-visible:border-admin-primary sm:h-9 sm:w-64"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-admin-line bg-admin-card text-admin-ink shadow-lg">
                  <SelectItem
                    value={INHERIT}
                    className="text-admin-ink data-highlighted:bg-admin-primary-soft data-highlighted:text-admin-primary"
                  >
                    Inherit: {inherited(email.slot)}
                  </SelectItem>
                  <SelectItem
                    value={String(STANDARD_CHOICE)}
                    className="text-admin-ink data-highlighted:bg-admin-primary-soft data-highlighted:text-admin-primary"
                  >
                    Standard
                  </SelectItem>
                  {options.map((version) => (
                    <SelectItem
                      key={version.id}
                      value={String(version.id)}
                      className="text-admin-ink data-highlighted:bg-admin-primary-soft data-highlighted:text-admin-primary"
                    >
                      {version.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
