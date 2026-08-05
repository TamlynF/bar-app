"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Users,
  SearchX,
  Mail,
  Phone,
  Cake,
  Ticket,
  Guitar,
  PartyPopper,
  Clock,
  ChevronRight,
  Trophy,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveContactAction, deleteContactAction } from "./actions";
import {
  activityTotal,
  emptyActivity,
  type ActivityByContact,
  type ContactActivity,
} from "./activity";
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
  parseRecordDate,
  toDateInputValue as toDateInput,
} from "@/components/admin";

export type ContactRecord = {
  id: number;
  full_name: string;
  email: string;
  country_code: string | null;
  phone_no: string | null;
  birthday: string | null;
  marketing_opt_in?: boolean;
  last_interaction_date?: string | null;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

export type EmployeeOption = { id: number; full_name: string | null };

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";

const INDENT = ["pl-4 sm:pl-5", "pl-9 sm:pl-10", "pl-14 sm:pl-15"];

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

// The trunk zero belongs to dialling from inside the country; with a code in
// front of it, it is wrong. Codes are free text here, so one already carrying
// brackets ("UK (+44)") is left as typed rather than wrapped twice.
function localNumber(contact: ContactRecord): string {
  return (contact.phone_no ?? "").trim().replace(/^0+/, "");
}

function displayPhone(contact: ContactRecord): string {
  const local = localNumber(contact);
  if (!local) return "-";
  const code = (contact.country_code ?? "").trim();
  if (!code) return local;
  return /[()]/.test(code) ? `${code} ${local}` : `(${code}) ${local}`;
}

function telHref(contact: ContactRecord): string | null {
  const local = localNumber(contact);
  if (!local) return null;
  const cleaned = `${contact.country_code ?? ""}${local}`.replace(/[^\d+]/g, "");
  return cleaned.length > 3 ? `tel:${cleaned}` : null;
}

function hasBirthdayThisMonth(birthday: string | null): boolean {
  if (!birthday) return false;
  const date = parseRecordDate(birthday);
  return !Number.isNaN(date.getTime()) && date.getMonth() === new Date().getMonth();
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Biggest group first, then alphabetical, so the shape of someone's history is
// readable before you expand anything.
function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  });
  return [...map.entries()].sort((a, z) => z[1].length - a[1].length || a[0].localeCompare(z[0]));
}

function BirthdayMarker() {
  return (
    <span
      role="img"
      aria-label="Birthday this month"
      title="Birthday this month"
      className="relative flex h-5 w-5 shrink-0 items-center justify-center"
    >
      <span aria-hidden="true" className="birthday-glow absolute inset-0 rounded-full" />
      <span className="birthday-wiggle relative flex items-center justify-center">
        <Cake className="birthday-party h-3.5 w-3.5" />
      </span>
    </span>
  );
}

// Live inside a row that opens the sheet, so every click has to stop there.
function ContactActions({ contact }: { contact: ContactRecord }) {
  const phone = telHref(contact);
  if (!contact.email && !phone) return null;

  return (
    <span className="hidden shrink-0 items-center gap-1 sm:flex">
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Email ${contact.full_name}`}
          title={`Email ${contact.email}`}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
        >
          <Mail className="h-3.5 w-3.5" />
        </a>
      )}
      {phone && (
        <a
          href={phone}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Call ${contact.full_name}`}
          title={`Call ${displayPhone(contact)}`}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}

function TreeRow({
  label,
  count,
  meta,
  depth = 0,
  children,
}: {
  label: string;
  count?: number;
  meta?: string;
  depth?: 0 | 1 | 2;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expandable = !!children;

  return (
    <div className="border-b border-admin-line last:border-0">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        className={cn(
          "flex w-full items-center gap-2 py-2.5 pr-4 text-left sm:pr-5",
          INDENT[depth],
          expandable && "hover:bg-admin-surface/60",
          !expandable && "cursor-default",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-admin-muted transition-transform",
            open && "rotate-90",
            !expandable && "invisible",
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            depth === 0
              ? "text-[13px] font-semibold text-admin-ink"
              : "text-[12px] font-medium text-admin-ink",
          )}
        >
          {label}
        </span>
        {meta && (
          <span className="shrink-0 text-[11px] font-medium text-admin-muted tabular-nums">
            {meta}
          </span>
        )}
        {count != null && (
          <span className="shrink-0 rounded-lg border border-admin-line bg-admin-surface px-2 py-0.5 text-[11px] font-semibold text-admin-muted tabular-nums">
            {count}
          </span>
        )}
      </button>
      {open && children}
    </div>
  );
}

function ActivityTree({ activity }: { activity: ContactActivity }) {
  const { bookings, bandRequests, privateHires } = activity;

  return (
    <>
      <TreeRow label="Bookings" count={bookings.length} depth={0}>
        {bookings.length > 0 &&
          groupBy(bookings, (b) => b.subtype).map(([subtype, rows]) => (
            <TreeRow key={subtype} label={subtype} count={rows.length} depth={1}>
              {rows.map((booking) => (
                <TreeRow
                  key={booking.id}
                  label={booking.title}
                  meta={formatDate(booking.date)}
                  depth={2}
                />
              ))}
            </TreeRow>
          ))}
      </TreeRow>

      <TreeRow label="Band requests" count={bandRequests.length} depth={0}>
        {bandRequests.length > 0 &&
          groupBy(bandRequests, (r) => toTitleCase(r.type)).map(([type, byType]) => (
            <TreeRow key={type} label={type} count={byType.length} depth={1}>
              {groupBy(byType, (r) => toTitleCase(r.genre)).map(([genre, rows]) => (
                <TreeRow key={genre} label={genre} count={rows.length} depth={2}>
                  {rows.map((request) => (
                    <TreeRow
                      key={request.id}
                      label={toTitleCase(request.status)}
                      meta={formatDate(request.date)}
                      depth={2}
                    />
                  ))}
                </TreeRow>
              ))}
            </TreeRow>
          ))}
      </TreeRow>

      <TreeRow label="Private hire" count={privateHires.length} depth={0}>
        {privateHires.length > 0 &&
          groupBy(privateHires, (h) => toTitleCase(h.reason)).map(([reason, rows]) => (
            <TreeRow key={reason} label={reason} count={rows.length} depth={1}>
              {rows.map((hire) => (
                <TreeRow
                  key={hire.id}
                  label={`${hire.guests} guest${hire.guests === 1 ? "" : "s"}`}
                  meta={formatDate(hire.date)}
                  depth={2}
                />
              ))}
            </TreeRow>
          ))}
      </TreeRow>
    </>
  );
}

export default function CustomersClient({
  initialContacts = [],
  employees = [],
  activity = {},
}: {
  initialContacts: ContactRecord[];
  employees?: EmployeeOption[];
  activity?: ActivityByContact;
}) {
  const sheet = useRecordSheet<ContactRecord>();
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [birthday, setBirthday] = useState("");
  const [optIn, setOptIn] = useState(false);

  const employeeById = useMemo(
    () => new Map(employees.map((e) => [e.id, e.full_name ?? "-"] as const)),
    [employees],
  );
  const employeeName = (id?: number | null) => (id ? (employeeById.get(id) ?? "-") : "-");
  const activityFor = (contact: ContactRecord) => activity[contact.id] ?? emptyActivity();

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialContacts;
    return initialContacts.filter((contact) =>
      [contact.full_name, contact.email, contact.phone_no, contact.country_code].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [initialContacts, query]);

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;

  const loadForm = (record: ContactRecord | null) => {
    setBirthday(toDateInput(record?.birthday));
    setOptIn(!!record?.marketing_opt_in);
  };

  const openAdd = () => {
    loadForm(null);
    sheet.openAdd();
  };

  const startEdit = () => {
    loadForm(selected);
    sheet.startEdit();
  };

  const cancel = () => {
    if (mode === "add") sheet.close();
    else if (selected) sheet.openView(selected);
  };

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Delete customer",
      description: "Delete this customer contact? This cannot be undone.",
      action: () => deleteContactAction(selected.id),
    });
  };

  const title =
    mode === "add" ? "New customer" : mode === "edit" ? "Edit customer" : "View customer";

  const selectedActivity = selected ? activityFor(selected) : emptyActivity();
  const quizBookings = selectedActivity.bookings.filter((b) => b.isQuiz);
  const quizWins = quizBookings.filter((b) => b.isWinner);
  const quizGroupNames = [
    ...new Set(quizBookings.map((b) => b.groupName?.trim()).filter((n): n is string => !!n)),
  ].sort((a, z) => a.localeCompare(z));

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialContacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add your first customer to get started"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create customer
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Customers"
          count={shown.length}
          onAdd={openAdd}
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search customers"
              placeholder="Search by name, email or phone"
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
            shown.map((contact) => {
              const counts = activityFor(contact);
              return (
                <ListRow key={contact.id} onClick={() => sheet.openView(contact)}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-admin-line bg-admin-surface text-[11px] font-semibold text-admin-primary">
                    {initialsOf(contact.full_name)}
                  </span>

                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1.7fr)_15rem_9rem] sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="min-w-0 truncate text-sm leading-snug font-semibold text-admin-ink">
                        {contact.full_name}
                      </p>
                      {hasBirthdayThisMonth(contact.birthday) && <BirthdayMarker />}
                      <span className="min-w-0 truncate text-[11px] font-medium text-admin-muted sm:text-[12px]">
                        {contact.email}
                      </span>
                      <ContactActions contact={contact} />
                    </div>

                    <div className="hidden items-center gap-1.5 sm:flex">
                      <InfoBadge icon={<Ticket className="h-3 w-3" />}>
                        {counts.bookings.length}
                      </InfoBadge>
                      <InfoBadge icon={<Guitar className="h-3 w-3" />}>
                        {counts.bandRequests.length}
                      </InfoBadge>
                      <InfoBadge icon={<PartyPopper className="h-3 w-3" />}>
                        {counts.privateHires.length}
                      </InfoBadge>
                    </div>

                    <p
                      className="hidden items-center gap-1.5 text-[11px] font-medium text-admin-muted sm:flex"
                      title={
                        contact.last_interaction_date
                          ? `Last seen ${formatDate(contact.last_interaction_date)}`
                          : "No activity on record"
                      }
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      <span className="sr-only">Last seen</span>
                      <span className="truncate tabular-nums">
                        {contact.last_interaction_date
                          ? formatDate(contact.last_interaction_date)
                          : "Never"}
                      </span>
                    </p>
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
        formId="customer-form"
        isPending={sheet.isPending}
        onEdit={startEdit}
        onDelete={handleDelete}
        onCancel={cancel}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <StatusPill
              tone={selected.marketing_opt_in ? "success" : "neutral"}
              icon={
                selected.marketing_opt_in ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )
              }
              showLabelOnMobile
            >
              {selected.marketing_opt_in ? "Marketing opted in" : "No marketing"}
            </StatusPill>
          )
        }
        systemInfo={
          selected == null
            ? undefined
            : {
                createdAt: selected.created_at,
                createdBy: employeeName(selected.created_by),
                updatedAt: selected.updated_at,
                updatedBy: employeeName(selected.updated_by),
              }
        }
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell label="Full name" value={selected.full_name} />
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
              <DetailCell label="Birthday" value={formatDate(selected.birthday)} />
              <DetailCell
                label="Marketing opt-in"
                value={selected.marketing_opt_in ? "Yes" : "No"}
              />
            </DetailCard>

            <DetailCard>
              <div className="flex items-center gap-2 border-b border-admin-line px-4 py-2 sm:px-5 sm:py-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-admin-primary">
                  <Ticket className="h-3.5 w-3.5" />
                  Bookings and requests
                </span>
                <span className="flex-1" />
                <span className="rounded-lg border border-admin-line bg-admin-surface px-2 py-0.5 text-[11px] font-semibold text-admin-muted tabular-nums">
                  {activityTotal(selectedActivity)} total
                </span>
              </div>

              <ActivityTree activity={selectedActivity} />

              <DetailCell
                label="Last seen"
                value={
                  selected.last_interaction_date
                    ? formatDate(selected.last_interaction_date)
                    : "Never"
                }
              />
            </DetailCard>

            <DetailCard>
              <div className="flex items-center gap-2 border-b border-admin-line px-4 py-2 sm:px-5 sm:py-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-admin-primary">
                  <Trophy className="h-3.5 w-3.5" />
                  Quiz record
                </span>
              </div>
              <DetailCell label="Quizzes entered" value={String(quizBookings.length)} />
              <DetailCell label="Quizzes won" value={String(quizWins.length)} />
              <DetailCell
                label="Team names"
                multiline
                value={quizGroupNames.length ? quizGroupNames.join("\n") : "-"}
              />
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="customer-form"
            action={sheet.submit(saveContactAction)}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
            <input type="hidden" name="marketing_opt_in" value={optIn ? "true" : "false"} />

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Full name" required>
                <input
                  name="full_name"
                  required
                  aria-label="Full name"
                  placeholder="e.g. Jane Doe"
                  defaultValue={formDefault?.full_name ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Email" required>
                <input
                  name="email"
                  type="email"
                  required
                  aria-label="Email"
                  placeholder="e.g. jane@example.com"
                  defaultValue={formDefault?.email ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Phone">
                <div className="flex flex-1 items-center justify-end gap-1.5">
                  <input
                    name="country_code"
                    size={5}
                    aria-label="Country code"
                    placeholder="+44"
                    defaultValue={formDefault?.country_code ?? ""}
                    className="w-auto bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40"
                  />
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

              <FormRow label="Marketing">
                <div className="flex flex-1 justify-end gap-1.5">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setOptIn(value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[12px] font-semibold",
                        optIn === value
                          ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
                          : "border-admin-line bg-admin-card text-admin-muted",
                      )}
                    >
                      {value ? "Opted in" : "No"}
                    </button>
                  ))}
                </div>
              </FormRow>
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </form>
        )}
      </RecordSheet>
    </div>
  );
}
