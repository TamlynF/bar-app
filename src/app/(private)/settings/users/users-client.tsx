"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Mail,
  KeyRound,
  Users,
  Check,
  X,
  Clock,
  Hourglass,
  Cake,
  SearchX,
  Briefcase,
  CalendarPlus,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { saveEmployeeAction, deleteEmployeeAction, sendPasswordResetAction } from "./actions";
import { cn } from "@/lib/utils";
import { COUNTRY_CODES } from "@/lib/country-codes";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
  DateField,
  formatRecordDate as formatDate,
  parseRecordDate as parseDbDate,
  toDateInputValue as toDateInput,
} from "@/components/admin";

export type SystemUserRecord = {
  id: number;
  full_name: string;
  birthday: string | null;
  email: string;
  country_code: string | null;
  phone_no: string | null;
  role: string | null;
  employment_type: string | null;
  start_date: string;
  end_date: string | null;
  status: string | null;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_by_employee?: { full_name: string; role: string | null } | null;
  updated_by_employee?: { full_name: string; role: string | null } | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
  password_reset_sent_at?: string | null;
};

// Labels match how the view sheet renders the same values, so nothing appears to
// change wording between reading and editing.
const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full Time" },
  { value: "part-time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "probationary", label: "Probationary" },
  { value: "seasonal", label: "Seasonal" },
  { value: "casual", label: "Casual" },
];

// The stored value stays "inactive"; only what a human reads changes.
const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Terminated" },
  { value: "leave", label: "On leave" },
];

// Terminated and on-leave are decisions somebody made, so the dates never
// overrule them. Pending and active are just a reading of the calendar.
const MANUAL_STATUSES = ["inactive", "leave"];

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
// text-right rather than the old dir-rtl, which right-aligned by reversing the
// writing direction and dragged punctuation around with it.
const FIELD_SELECT =
  "flex-1 cursor-pointer appearance-none bg-transparent text-right text-sm font-semibold text-admin-ink outline-none";

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

// How long they have been employed. A leaving date that has passed stops the
// clock at that date; one still in the future has not happened yet, so the
// count keeps running to today.
function tenure(user: SystemUserRecord): { months: number; hasLeft: boolean } | null {
  if (!user.start_date) return null;
  const start = parseDbDate(user.start_date);
  if (Number.isNaN(start.getTime())) return null;

  const today = new Date();
  const end = user.end_date ? parseDbDate(user.end_date) : null;
  const hasLeft = !!end && !Number.isNaN(end.getTime()) && end <= today;
  const until = hasLeft && end ? end : today;

  const months =
    (until.getFullYear() - start.getFullYear()) * 12 +
    (until.getMonth() - start.getMonth()) -
    (until.getDate() < start.getDate() ? 1 : 0);

  return months < 0 ? null : { months, hasLeft };
}

function formatMonths(months: number): string {
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}y ${rest}m` : `${years}y`;
}

function hasBirthdayThisMonth(birthday: string | null): boolean {
  if (!birthday) return false;
  const date = parseDbDate(birthday);
  return !Number.isNaN(date.getTime()) && date.getMonth() === new Date().getMonth();
}

function statusOf(user: SystemUserRecord) {
  const status = user.status?.toLowerCase();
  if (status === "active") return { tone: "success" as const, label: "Active" };
  if (status === "leave") return { tone: "warning" as const, label: "On leave" };
  if (status === "pending") return { tone: "info" as const, label: "Pending" };
  return { tone: "error" as const, label: "Terminated" };
}

function statusIcon(tone: "success" | "warning" | "error" | "info") {
  if (tone === "success") return <Check className="h-3 w-3" />;
  if (tone === "warning") return <Clock className="h-3 w-3" />;
  if (tone === "info") return <Hourglass className="h-3 w-3" />;
  return <X className="h-3 w-3" />;
}

// Not yet started stays pending; started and not yet finished is active. A
// status somebody chose by hand is left where they put it.
function statusFromDates(current: string, start: string, end: string): string {
  if (MANUAL_STATUSES.includes(current)) return current;
  if (!start) return current;

  const startsOn = parseDbDate(start);
  if (Number.isNaN(startsOn.getTime())) return current;

  const now = new Date();
  if (startsOn > now) return "pending";

  const endsOn = end ? parseDbDate(end) : null;
  const stillOn = !endsOn || Number.isNaN(endsOn.getTime()) || endsOn > now;
  return stillOn ? "active" : current;
}

// The trunk zero belongs to dialling from inside the country; with a code in
// front of it, it is wrong. "07845 025877" from the UK is "(+44) 7845025877".
function localNumber(user: SystemUserRecord): string {
  return (user.phone_no ?? "").trim().replace(/^0+/, "");
}

function displayPhone(user: SystemUserRecord): string {
  const local = localNumber(user);
  if (!local) return "-";
  return user.country_code ? `(${user.country_code}) ${local}` : local;
}

function telHref(user: SystemUserRecord): string | null {
  const local = localNumber(user);
  if (!local) return null;
  const cleaned = `${user.country_code ?? ""}${local}`.replace(/[^\d+]/g, "");
  return cleaned.length > 3 ? `tel:${cleaned}` : null;
}

// Live inside a row that opens the sheet, so every click has to stop there.
function ContactActions({ user }: { user: SystemUserRecord }) {
  const phone = telHref(user);
  if (!user.email && !phone) return null;

  return (
    <span className="hidden shrink-0 items-center gap-1 sm:flex">
      {user.email && (
        <a
          href={`mailto:${user.email}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Email ${user.full_name}`}
          title={`Email ${user.email}`}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
        >
          <Mail className="h-3.5 w-3.5" />
        </a>
      )}
      {phone && (
        <a
          href={phone}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Call ${user.full_name}`}
          title={`Call ${displayPhone(user)}`}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function SystemUsersClient({
  initialUsers = [],
}: {
  initialUsers: SystemUserRecord[];
}) {
  const sheet = useRecordSheet<SystemUserRecord>({
    records: initialUsers,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [birthday, setBirthday] = useState("");

  // A brand new user starts pending and stays there until a date says otherwise.
  const loadForm = (record: SystemUserRecord | null) => {
    setFormStatus(record?.status ?? "pending");
    setStartDate(toDateInput(record?.start_date) || format(new Date(), "yyyy-MM-dd"));
    setEndDate(toDateInput(record?.end_date));
    setBirthday(toDateInput(record?.birthday));
  };

  const changeStartDate = (next: string) => {
    setStartDate(next);
    setFormStatus((current) => statusFromDates(current, next, endDate));
  };

  const changeEndDate = (next: string) => {
    setEndDate(next);
    setFormStatus((current) => statusFromDates(current, startDate, next));
  };

  const openAdd = () => {
    loadForm(null);
    sheet.openAdd();
  };

  const startEdit = () => {
    loadForm(selected);
    sheet.startEdit();
  };

  // Marking someone terminated dates the departure to the moment you said so,
  // unless a leaving date is already on record.
  const changeStatus = (next: string) => {
    setFormStatus(next);
    if (next === "inactive" && !endDate) setEndDate(format(new Date(), "yyyy-MM-dd"));
  };

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialUsers;
    return initialUsers.filter((user) =>
      [user.full_name, user.email, user.role, user.employment_type].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [initialUsers, query]);

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;

  const cancel = () => {
    if (mode === "add") sheet.close();
    else if (selected) sheet.openView(selected);
  };

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Remove user",
      description: "Are you sure you want to remove this system user? This cannot be undone.",
      confirmLabel: "Remove",
      action: () => deleteEmployeeAction(selected.id),
    });
  };

  const handlePasswordReset = async (email: string) => {
    const ok = await sheet.confirm({
      title: "Reset password",
      description: `Send a password reset email to ${email}?`,
      confirmLabel: "Send email",
    });
    if (!ok) return;
    const result = await sendPasswordResetAction(email);
    sheet.setFormError(result?.error ?? null);
  };

  const title = mode === "add" ? "New user" : mode === "edit" ? "Edit user" : "View user";

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No system users yet"
          description="Add your first user to get started"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create user
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="System users"
          count={shown.length}
          onAdd={openAdd}
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search system users"
              placeholder="Search by name, email, role or contract"
            />
          }
        >
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
              <SearchX className="mb-1 h-7 w-7 text-admin-muted opacity-30" />
              <p className="text-sm font-semibold text-admin-ink">No matches</p>
              <p className="text-[11px] text-admin-muted">
                Nothing here matches &ldquo;{query.trim()}&rdquo;
              </p>
            </div>
          ) : (
            shown.map((user) => {
                const status = statusOf(user);
                const inactive = status.tone !== "success";
                return (
                  <ListRow
                    key={user.id}
                    onClick={() => sheet.openView(user)}
                    status={
                      // Fixed width, so "On leave" cannot narrow that row's grid
                      // and knock its email out of line with the rest.
                      <StatusPill
                        tone={status.tone}
                        icon={statusIcon(status.tone)}
                        className="sm:w-24 sm:justify-center"
                      >
                        {status.label}
                      </StatusPill>
                    }
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-admin-line bg-admin-surface text-[11px] font-semibold",
                        inactive ? "text-admin-muted" : "text-admin-primary",
                      )}
                    >
                      {initialsOf(user.full_name)}
                    </span>

                    {/* Fixed tracks, not content-sized ones - an "auto" column
                        takes its width from that row's own badges, which is what
                        left every email starting somewhere different. */}
                    <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_14rem_11.5rem_6.5rem] sm:items-center sm:gap-3">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p
                          className={cn(
                            "min-w-0 truncate text-sm leading-snug font-semibold",
                            inactive ? "text-admin-muted" : "text-admin-ink",
                          )}
                        >
                          {user.full_name}
                        </p>
                        {hasBirthdayThisMonth(user.birthday) && (
                          // One element can only run one animation, so the halo,
                          // the wiggle and the colour cycle each get their own.
                          <span
                            role="img"
                            aria-label="Birthday this month"
                            title="Birthday this month"
                            className="relative flex h-5 w-5 shrink-0 items-center justify-center"
                          >
                            <span
                              aria-hidden="true"
                              className="birthday-glow absolute inset-0 rounded-full"
                            />
                            <span className="birthday-wiggle relative flex items-center justify-center">
                              <Cake className="birthday-party h-3.5 w-3.5" />
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex min-w-0 items-center gap-1 sm:mt-0">
                        <span className="truncate text-[11px] font-medium text-admin-muted sm:text-[12px]">
                          {user.email}
                        </span>
                        <ContactActions user={user} />
                      </div>

                      <div className="hidden items-center gap-2 sm:flex">
                        <InfoBadge icon={null}>
                          {toTitleCase(user.role) || "No role"}
                        </InfoBadge>
                        <InfoBadge icon={null}>
                          {toTitleCase(user.employment_type?.replace("-", " ")) || "-"}
                        </InfoBadge>
                      </div>

                      <p
                        className="hidden items-center gap-1.5 text-[11px] font-medium text-admin-muted sm:flex"
                        title={
                          user.end_date
                            ? `Started ${formatDate(user.start_date)}, left ${formatDate(user.end_date)}`
                            : `Started ${formatDate(user.start_date)}`
                        }
                      >
                        <CalendarPlus
                          className="h-3.5 w-3.5 shrink-0 opacity-60"
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          {user.end_date ? "Employed from" : "Started"}
                        </span>
                        <span className="truncate tabular-nums">
                          {user.end_date
                            ? `${formatDate(user.start_date)} - ${formatDate(user.end_date)}`
                            : formatDate(user.start_date)}
                        </span>
                      </p>

                      {(() => {
                        const served = tenure(user);
                        const value = served ? formatMonths(served.months) : "-";
                        return (
                          <p
                            className="hidden items-center gap-1.5 text-[11px] font-medium text-admin-muted sm:flex"
                            title={
                              served
                                ? served.hasLeft
                                  ? `Was employed for ${value}`
                                  : `Employed for ${value}`
                                : "No start date on record"
                            }
                          >
                            <Briefcase className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                            <span className="sr-only">
                              {served?.hasLeft ? "Was employed for" : "Employed for"}
                            </span>
                            <span className="tabular-nums">{value}</span>
                          </p>
                        );
                      })()}
                    </div>
                  </ListRow>
                );
            })
          )}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={mode}
        title={title}
        recordId={selected?.id}
        formId="user-form"
        isPending={sheet.isPending}
        onEdit={startEdit}
        onDelete={handleDelete}
        onCancel={cancel}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <StatusPill
              tone={statusOf(selected).tone}
              icon={statusIcon(statusOf(selected).tone)}
              showLabelOnMobile
            >
              {statusOf(selected).label}
            </StatusPill>
          )
        }
        systemInfo={
          selected == null
            ? undefined
            : {
                createdAt: selected.created_at,
                createdBy: selected.created_by_employee?.full_name,
                updatedAt: selected.updated_at,
                updatedBy: selected.updated_by_employee?.full_name,
                rows: [
                  {
                    label: "Invite accepted",
                    value: selected.invite_accepted_at
                      ? formatDate(selected.invite_accepted_at)
                      : selected.invite_sent_at
                        ? "Pending"
                        : "Not invited",
                  },
                ],
              }
        }
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell label="Full name" value={selected.full_name} />
              <DetailCell label="Role" value={toTitleCase(selected.role) || "-"} />
              <DetailCell
                label="Contract"
                value={toTitleCase(selected.employment_type?.replace("-", " ")) || "-"}
              />
              <DetailCell
                label="Email"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span className="break-all">{selected.email}</span>
                    {selected.email && (
                      <a
                        href={`mailto:${selected.email}`}
                        aria-label={`Email ${selected.full_name}`}
                        title={`Email ${selected.email}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </span>
                }
              />
              <DetailCell
                label="Phone"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span>{displayPhone(selected)}</span>
                    {telHref(selected) && (
                      <a
                        href={telHref(selected) as string}
                        aria-label={`Call ${selected.full_name}`}
                        title="Call this number"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </span>
                }
              />
              <DetailCell label="Start date" value={formatDate(selected.start_date)} />
              {selected.end_date && (
                <DetailCell label="End date" value={formatDate(selected.end_date)} />
              )}
              <DetailCell label="Birthday" value={formatDate(selected.birthday)} />
            </DetailCard>

            <DetailCard>
              <div className="flex items-center gap-2 border-b border-admin-line px-4 py-2 sm:px-5 sm:py-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-admin-primary">
                  <Mail className="h-3.5 w-3.5" />
                  Account access
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => handlePasswordReset(selected.email)}
                  disabled={sheet.isPending}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-xl bg-admin-primary px-3 text-white transition-colors hover:bg-admin-primary-hover disabled:opacity-50"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold">Reset password</span>
                </button>
              </div>
              <DetailCell
                label="Invite sent"
                value={selected.invite_sent_at ? formatDate(selected.invite_sent_at) : "Not sent"}
              />
              <DetailCell
                label="Invite accepted"
                value={
                  selected.invite_accepted_at
                    ? formatDate(selected.invite_accepted_at)
                    : selected.invite_sent_at
                      ? "Pending"
                      : "-"
                }
              />
              <DetailCell
                label="Password reset sent"
                value={
                  selected.password_reset_sent_at
                    ? formatDate(selected.password_reset_sent_at)
                    : "-"
                }
              />
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="user-form"
            action={sheet.submit(saveEmployeeAction)}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Full name" required>
                <input
                  name="full_name"
                  required
                  aria-label="Full name"
                  placeholder="e.g. John Smith"
                  defaultValue={formDefault?.full_name ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Status">
                <select
                  name="status"
                  aria-label="Status"
                  value={formStatus}
                  onChange={(e) => changeStatus(e.target.value)}
                  className={FIELD_SELECT}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FormRow>

              <FormRow label="Role">
                <input
                  name="role"
                  aria-label="Role"
                  placeholder="e.g. Manager"
                  defaultValue={formDefault?.role ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Contract">
                <select
                  name="employment_type"
                  aria-label="Employment type"
                  defaultValue={formDefault?.employment_type ?? "full-time"}
                  className={FIELD_SELECT}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormRow>

              <FormRow label="Start date" required>
                <DateField
                  name="start_date"
                  label="Start date"
                  value={startDate}
                  onChange={changeStartDate}
                  clearable={false}
                />
              </FormRow>

              <FormRow label="End date">
                <DateField
                  name="end_date"
                  label="End date"
                  value={endDate}
                  onChange={changeEndDate}
                />
              </FormRow>

              <FormRow label="Email" required>
                <input
                  name="email"
                  type="email"
                  required
                  aria-label="Email"
                  placeholder="e.g. john@company.com"
                  defaultValue={formDefault?.email ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Phone">
                <div className="flex flex-1 items-center justify-end gap-1.5">
                  <select
                    name="country_code"
                    aria-label="Country code"
                    defaultValue={formDefault?.country_code ?? "+44"}
                    // The native option list takes its width from the control, so
                    // a shrink-to-fit select clipped the dialling codes.
                    className="w-28 cursor-pointer appearance-none bg-transparent text-right text-[12px] font-semibold text-admin-ink outline-none"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.iso + c.code} value={c.code}>
                        {c.iso} {c.code}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-admin-muted/50">|</span>
                  <input
                    name="phone_no"
                    type="tel"
                    size={11}
                    aria-label="Phone number"
                    placeholder="7123 456789"
                    defaultValue={formDefault?.phone_no ?? ""}
                    className="w-auto bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40"
                  />
                </div>
              </FormRow>

              <FormRow label="Birthday">
                <DateField
                  name="birthday"
                  label="Birthday"
                  value={birthday}
                  onChange={setBirthday}
                />
              </FormRow>
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </form>
        )}
      </RecordSheet>
    </div>
  );
}
