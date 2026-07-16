"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  Mail,
  KeyRound,
  Users,
  ChevronRight,
  ChevronDown,
  Save,
  Pencil,
  Trash2,
  Hash,
  AlertCircle,
} from "lucide-react";
import { saveEmployeeAction, deleteEmployeeAction, sendPasswordResetAction } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type EmployeeRecord = {
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

const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "probationary", label: "Probationary" },
  { value: "seasonal", label: "Seasonal" },
  { value: "casual", label: "Casual" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "leave", label: "On Leave" },
];

import { COUNTRY_CODES } from "@/lib/country-codes";

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function EmployeesClient({ initialEmployees = [] }: { initialEmployees: EmployeeRecord[] }) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<EmployeeRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isSheetOpen = !!selected || isAdding;

  const openView = (employee: EmployeeRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(employee);
  };

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setIsAdding(true);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
  };

  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveEmployeeAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Remove employee",
      description: "Are you sure you want to remove this system user? This cannot be undone.",
      confirmLabel: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteEmployeeAction(selected.id);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const handlePasswordReset = async (email: string) => {
    const ok = await confirm({
      title: "Reset password",
      description: `Send a password reset email to ${email}?`,
      confirmLabel: "Send email",
      variant: "default",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await sendPasswordResetAction(email);
      if (result?.error) {
        setFormError(result.error);
      } else {
        setFormError(null);
      }
    });
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  return (
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">

      {/* Employee List */}
      {initialEmployees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
          <p className="font-black text-sm text-[#1F1F1A]">No employees yet</p>
          <p className="mt-1 text-[11px] text-[#5F624F]">Add your first employee to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          <section className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
            <div className="flex items-center gap-2 bg-[#F7F4EA] px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[11px] font-bold tracking-wide text-[#5C4033] uppercase">
                  Employees <span className="text-[#5F624F]">({initialEmployees.length})</span>
                </p>
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="flex h-7 w-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] text-white transition-colors hover:bg-[#1B4332]/85 sm:h-7 sm:w-auto sm:px-2.5"
                title="Add Employee"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden font-black text-[10px] tracking-widest uppercase sm:inline">Create</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="shrink-0"
                title="Toggle group"
              >
                <ChevronDown className={cn(
                  "h-4 w-4 text-[#5F624F] transition-transform duration-200",
                  !isCollapsed && "rotate-180"
                )} />
              </button>
            </div>

            {!isCollapsed && <div className="divide-y divide-[#E6DFC8]/50">
              {initialEmployees.map((employee) => {
                const empStatus = employee.status?.toLowerCase();
                const isActive = empStatus === "active";
                const isLeave = empStatus === "leave";
                const inactive = !isActive;
                const muted = "text-[#5F624F]";
                const initials = employee.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <div
                    key={employee.id}
                    onClick={() => openView(employee)}
                    className="flex cursor-pointer items-center gap-2 px-3 py-3 transition-colors hover:bg-[#F7F4EA]/50 active:scale-[0.99] sm:gap-3 sm:px-4"
                  >
                    {/* Mobile layout */}
                    <div className="min-w-0 flex-1 sm:hidden">
                      {/* Row 1: name + status */}
                      <div className="flex items-center gap-2">
                        <p className={cn("min-w-0 flex-1 truncate font-black text-xs leading-snug", inactive ? muted : "text-[#1F1F1A]")}>
                          {employee.full_name}
                        </p>
                        <span className={cn(
                          "w-14 shrink-0 text-right text-[10px] font-bold",
                          isActive ? "text-green-600" : isLeave ? "text-amber-600" : "text-red-500"
                        )}>
                          {isActive ? "Active" : isLeave ? "Leave" : "Inactive"}
                        </span>
                      </div>
                      {/* Row 2: role | contract | initials */}
                      <div className="mt-0.5 flex items-center gap-1">
                        <p className={cn("min-w-0 flex-1 truncate text-[10px] font-medium", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                          {toTitleCase(employee.role) || "No role"}
                        </p>
                        <span className={cn("shrink-0 text-[10px] font-bold", muted)}>
                          {toTitleCase(employee.employment_type?.replace("-", " ")) || "—"}
                        </span>
                        <span className="flex w-6 shrink-0 items-center justify-center">
                          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border border-[#E6DFC8] bg-[#F7F4EA] text-[10px] font-bold", muted)}>
                            {initials}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden min-w-0 flex-1 sm:block">
                      <p className={cn("truncate font-black text-sm leading-snug", inactive ? muted : "text-[#1F1F1A]")}>
                        {employee.full_name}
                      </p>
                      <p className={cn("mt-0.5 truncate text-[11px] font-medium", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                        {employee.email}
                      </p>
                    </div>

                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <span className="rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 text-[11px] font-bold text-[#5F624F]">
                        {toTitleCase(employee.role) || "No role"}
                      </span>
                      <span className="rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 text-[11px] font-bold text-[#5F624F]">
                        {toTitleCase(employee.employment_type?.replace("-", " ")) || "—"}
                      </span>
                      <span className={cn(
                        "rounded-lg border px-2 py-1 text-[11px] font-bold",
                        isActive
                          ? "border-green-200 bg-green-50 text-green-700"
                          : isLeave
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-red-200 bg-red-50 text-red-500"
                      )}>
                        {isActive ? "Active" : isLeave ? "On Leave" : "Inactive"}
                      </span>
                    </div>

                    <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F] opacity-40" />
                  </div>
                );
              })}
            </div>}
          </section>
        </div>
      )}

      {/* Bottom Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8]
            bg-[#F7F4EA] p-0 shadow-2xl outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto
            sm:max-h-[80vh] sm:w-140 sm:-translate-x-1/2 sm:rounded-4xl
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#1F1F1A] uppercase">
                  {isAdding ? "New Employee" : isEditing ? "Edit Employee" : "View Employee"}
                </SheetTitle>
                {selected && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-[#5F624F]" />
                    <span className="text-xs font-bold tracking-wide text-[#5F624F] uppercase tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <span className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold",
                  selected.status?.toLowerCase() === "active"
                    ? "border-green-300 bg-green-100 text-green-700"
                    : selected.status?.toLowerCase() === "leave"
                    ? "border-amber-300 bg-amber-100 text-amber-700"
                    : "border-red-300 bg-red-100 text-red-600"
                )}>
                  {selected.status?.toLowerCase() === "active" ? "Active" : selected.status?.toLowerCase() === "leave" ? "On Leave" : "Inactive"}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">

            {/* View mode */}
            {!showForm && selected && (() => {
              const phone = [selected.country_code, selected.phone_no].filter(Boolean).join(" ");
              return (
                <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                  {/* Employee details */}
                  <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                    <DetailCell label="Full Name" value={selected.full_name} />
                    <DetailCell label="Role" value={toTitleCase(selected.role) || "—"} />
                    <DetailCell label="Contract" value={toTitleCase(selected.employment_type?.replace("-", " ")) || "—"} />
                    <DetailCell label="Email" value={selected.email} />
                    <DetailCell label="Phone" value={phone || "—"} />
                    <DetailCell label="Started" value={formatDate(selected.start_date)} />
                    <DetailCell label="Left" value={formatDate(selected.end_date)} />
                    <DetailCell label="Birthday" value={formatDate(selected.birthday)} />
                  </div>

                  {/* Account Access */}
                  <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                    <div className="flex items-center gap-2 border-b border-[#E6DFC8] px-4 py-2 sm:px-5 sm:py-3">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-[#5C4033] uppercase">
                        <Mail className="h-3 w-3" />
                        Account Access
                      </span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => handlePasswordReset(selected.email)}
                        disabled={isPending}
                        className="flex h-7 items-center justify-center gap-1.5 rounded-xl bg-[#5C4033] px-2.5 text-white transition-colors hover:bg-[#5C4033]/85"
                        title="Send password reset email"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold tracking-wide uppercase">Reset Password</span>
                      </button>
                    </div>
                    <DetailCell
                      label="Invite Sent"
                      value={selected.invite_sent_at ? formatDate(selected.invite_sent_at) : "Not sent"}
                    />
                    <DetailCell
                      label="Invite Accepted"
                      value={selected.invite_accepted_at ? formatDate(selected.invite_accepted_at) : selected.invite_sent_at ? "Pending" : "—"}
                    />
                    <DetailCell
                      label="Password Reset Sent"
                      value={selected.password_reset_sent_at ? formatDate(selected.password_reset_sent_at) : "—"}
                    />
                  </div>

                  {formError && <ErrorBox message={formError} />}
                </div>
              );
            })()}

            {/* Edit / Add form */}
            {showForm && (
              <form id="employee-form" action={handleSubmit} className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

                <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  {/* Full Name */}
                  <FormRow label="Full Name" required>
                    <input
                      name="full_name"
                      required
                      placeholder="e.g. John Smith"
                      defaultValue={formDefault?.full_name ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  {/* Status */}
                  <FormRow label="Status">
                    <select
                      title="Status"
                      name="status"
                      defaultValue={formDefault?.status ?? "active"}
                      className="dir-rtl flex-1 cursor-pointer appearance-none bg-transparent font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    >
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value} className="dir-ltr">{s.label}</option>)}
                    </select>
                  </FormRow>

                  {/* Role */}
                  <FormRow label="Role">
                    <input
                      name="role"
                      placeholder="e.g. Manager"
                      defaultValue={formDefault?.role ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  {/* Contract Type */}
                  <FormRow label="Contract">
                    <select
                      title="Employment Type"
                      name="employment_type"
                      defaultValue={formDefault?.employment_type ?? "full-time"}
                      className="dir-rtl flex-1 cursor-pointer appearance-none bg-transparent font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    >
                      {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value} className="dir-ltr">{t.label}</option>)}
                    </select>
                  </FormRow>

                  {/* Start Date */}
                  <FormRow label="Started" required>
                    <input
                      title="Start Date"
                      name="start_date"
                      type="date"
                      required
                      defaultValue={
                        formDefault?.start_date
                          ? new Date(formDefault.start_date).toISOString().split("T")[0]
                          : new Date().toISOString().split("T")[0]
                      }
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    />
                  </FormRow>

                  {/* End Date */}
                  <FormRow label="Left">
                    <input
                      title="End Date"
                      name="end_date"
                      type="date"
                      defaultValue={
                        formDefault?.end_date
                          ? new Date(formDefault.end_date).toISOString().split("T")[0]
                          : ""
                      }
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    />
                  </FormRow>

                  {/* Email */}
                  <FormRow label="Email" required>
                    <input
                      name="email"
                      type="email"
                      placeholder="e.g. john@company.com"
                      required
                      defaultValue={formDefault?.email ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  {/* Phone */}
                  <FormRow label="Phone">
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <select
                        title="Country Code"
                        name="country_code"
                        defaultValue={formDefault?.country_code ?? "+44"}
                        className="w-18 cursor-pointer appearance-none bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.iso + c.code} value={c.code}>{c.iso} {c.code}</option>
                        ))}
                      </select>
                      <span className="text-xs text-[#5F624F]/50">|</span>
                      <input
                        name="phone_no"
                        type="tel"
                        placeholder="7123 456789"
                        defaultValue={formDefault?.phone_no ?? ""}
                        className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                      />
                    </div>
                  </FormRow>

                  {/* Birthday */}
                  <FormRow label="Birthday">
                    <input
                      title="Birthday"
                      name="birthday"
                      type="date"
                      defaultValue={
                        formDefault?.birthday
                          ? new Date(formDefault.birthday).toISOString().split("T")[0]
                          : ""
                      }
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    />
                  </FormRow>
                </div>

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="z-40 shrink-0 border-t-2 border-[#E6DFC8] bg-white/80 px-6 py-5 pb-10 backdrop-blur-md sm:rounded-b-4xl sm:pb-5">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 font-black text-[10px] tracking-wide text-red-500 uppercase hover:border-red-200 hover:bg-red-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#B45309] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#B45309]/85 active:scale-95"
                >
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormError(null);
                    if (isAdding) closeSheet();
                    else setIsEditing(false);
                  }}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-wide text-[#5F624F] uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="employee-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#1B4332] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95"
                >
                  {isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Save className="mr-2 h-4 w-4" />Save</>}
                </Button>
              </div>
            )}
          </div>
          {ConfirmDialogUI}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
        {required && <span className="text-[10px] font-bold text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[#E6DFC8] px-4 py-2.5 last:border-0 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
      </div>
      <span className="flex-1 text-right font-black text-base leading-snug break-all text-[#1F1F1A] sm:text-sm">
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <p className="text-sm leading-snug font-bold text-red-700">{message}</p>
    </div>
  );
}
