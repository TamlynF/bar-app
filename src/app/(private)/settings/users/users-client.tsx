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
  is_skeleton_staff: boolean | null;
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
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">

      {/* Employee List */}
      {initialEmployees.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <Users className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No employees yet</p>
          <p className="text-[11px] text-[#5F624F] mt-1">Add your first employee to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
            <div className="flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3 gap-2">
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-[11px] font-black uppercase tracking-widest text-[#26300D] truncate">
                  Employees <span className="text-[#5F624F]">({initialEmployees.length})</span>
                </p>
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="w-7 h-7 sm:h-7 sm:w-auto sm:px-2.5 rounded-lg bg-[#26300D] text-[#FDCC4B] hover:bg-[#26300D]/85 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                title="Add Employee"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Create</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="shrink-0"
                title="Toggle group"
              >
                <ChevronDown className={cn(
                  "w-4 h-4 text-[#5F624F] transition-transform duration-200",
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
                    className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-[#F7F4EA]/50 transition-colors active:scale-[0.99]"
                  >
                    {/* Mobile layout */}
                    <div className="flex-1 min-w-0 sm:hidden">
                      {/* Row 1: name + status */}
                      <div className="flex items-center gap-2">
                        <p className={cn("text-xs font-black leading-snug truncate flex-1 min-w-0", inactive ? muted : "text-[#1F1F1A]")}>
                          {employee.full_name}
                        </p>
                        <span className={cn(
                          "text-[10px] font-black shrink-0 w-14 text-right",
                          isActive ? "text-green-600" : isLeave ? "text-amber-600" : "text-red-500"
                        )}>
                          {isActive ? "Active" : isLeave ? "Leave" : "Inactive"}
                        </span>
                      </div>
                      {/* Row 2: role | contract | initials */}
                      <div className="flex items-center mt-0.5 gap-1">
                        <p className={cn("text-[10px] font-medium truncate flex-1 min-w-0", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                          {toTitleCase(employee.role) || "No role"}
                        </p>
                        <span className={cn("text-[10px] font-black shrink-0", muted)}>
                          {toTitleCase(employee.employment_type?.replace("-", " ")) || "—"}
                        </span>
                        <span className="w-6 flex items-center justify-center shrink-0">
                          <span className={cn("text-[10px] font-black bg-[#F7F4EA] border border-[#E6DFC8] w-6 h-6 rounded-full flex items-center justify-center", muted)}>
                            {initials}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden sm:block flex-1 min-w-0">
                      <p className={cn("text-sm font-black leading-snug truncate", inactive ? muted : "text-[#1F1F1A]")}>
                        {employee.full_name}
                      </p>
                      <p className={cn("text-[11px] font-medium mt-0.5 truncate", inactive ? "text-[#5F624F]/50" : "text-[#5F624F]")}>
                        {employee.email}
                      </p>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg">
                        {toTitleCase(employee.role) || "No role"}
                      </span>
                      <span className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg">
                        {toTitleCase(employee.employment_type?.replace("-", " ")) || "—"}
                      </span>
                      <span className={cn(
                        "text-[11px] font-black px-2 py-1 rounded-lg border",
                        isActive
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : isLeave
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : "text-red-500 bg-red-50 border-red-200"
                      )}>
                        {isActive ? "Active" : isLeave ? "On Leave" : "Inactive"}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
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
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px]
            sm:h-auto sm:max-h-[80vh] sm:rounded-[2rem] sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                  {isAdding ? "New Employee" : isEditing ? "Edit Employee" : "View Employee"}
                </SheetTitle>
                {selected && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-xs font-black text-[#5F624F] uppercase tracking-widest tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
              {selected && !isAdding && (
                <span className={cn(
                  "shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full border",
                  selected.status?.toLowerCase() === "active"
                    ? "bg-green-100 text-green-700 border-green-300"
                    : selected.status?.toLowerCase() === "leave"
                    ? "bg-amber-100 text-amber-700 border-amber-300"
                    : "bg-red-100 text-red-600 border-red-300"
                )}>
                  {selected.status?.toLowerCase() === "active" ? "Active" : selected.status?.toLowerCase() === "leave" ? "On Leave" : "Inactive"}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4 sm:space-y-5">

            {/* View mode */}
            {!showForm && selected && (() => {
              const phone = [selected.country_code, selected.phone_no].filter(Boolean).join(" ");
              return (
                <div className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                  {/* Employee details */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
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
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-3 border-b border-[#E6DFC8]">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#26300D] flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        Account Access
                      </span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => handlePasswordReset(selected.email)}
                        disabled={isPending}
                        className="h-7 rounded-xl bg-[#26300D] flex items-center justify-center text-[#FDCC4B] hover:bg-[#26300D]/85 transition-colors px-2.5 gap-1.5"
                        title="Send password reset email"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Reset Password</span>
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
              <form id="employee-form" action={handleSubmit} className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]/50">
                  {/* Full Name */}
                  <FormRow label="Full Name" required>
                    <input
                      name="full_name"
                      required
                      placeholder="e.g. John Smith"
                      defaultValue={formDefault?.full_name ?? ""}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  {/* Status */}
                  <FormRow label="Status">
                    <select
                      title="Status"
                      name="status"
                      defaultValue={formDefault?.status ?? "active"}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
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
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  {/* Contract Type */}
                  <FormRow label="Contract">
                    <select
                      title="Employment Type"
                      name="employment_type"
                      defaultValue={formDefault?.employment_type ?? "full-time"}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
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
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
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
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
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
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </FormRow>

                  {/* Phone */}
                  <FormRow label="Phone">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <select
                        title="Country Code"
                        name="country_code"
                        defaultValue={formDefault?.country_code ?? "+44"}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none appearance-none cursor-pointer w-[4.5rem] text-right"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.iso + c.code} value={c.code}>{c.iso} {c.code}</option>
                        ))}
                      </select>
                      <span className="text-[#5F624F]/50 text-xs">|</span>
                      <input
                        name="phone_no"
                        type="tel"
                        placeholder="7123 456789"
                        defaultValue={formDefault?.phone_no ?? ""}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none text-right flex-1 placeholder:text-[#5F624F]/40"
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
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none"
                    />
                  </FormRow>
                </div>

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-widest text-[10px] bg-white hover:bg-red-50 hover:border-red-200"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-2" />Edit
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
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-widest text-[10px] bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="employee-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  {isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Save className="w-4 h-4 mr-2" />Save</>}
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
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
          {label}
        </span>
        {required && <span className="text-red-500 text-[10px] font-black">*</span>}
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
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
          {label}
        </span>
      </div>
      <span className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug break-all">
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 font-bold leading-snug">{message}</p>
    </div>
  );
}
