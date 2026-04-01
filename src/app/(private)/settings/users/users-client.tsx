"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  Mail,
  Phone,
  Calendar,
  ShieldAlert,
  KeyRound,
  Users,
  XCircle,
  CheckCircle2,
  ChevronRight,
  Save,
  Pencil,
  Trash2,
  Hash,
  AlertCircle,
} from "lucide-react";
import { saveEmployeeAction, deleteEmployeeAction, sendPasswordResetAction } from "./actions";
import { cn } from "@/lib/utils";

export type EmployeeRecord = {
  id: number;
  full_name: string;
  birthday: string | null;
  email: string;
  country_code: string | null;
  phone_no: string | null;
  role: string | null;
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
};

export default function EmployeesClient({ initialEmployees = [] }: { initialEmployees: EmployeeRecord[] }) {
  const [selected, setSelected] = useState<EmployeeRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // ── Sheet helpers ──────────────────────────────────────────────────────────
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

  // ── Actions ────────────────────────────────────────────────────────────────
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

  const handleDelete = () => {
    if (!selected) return;
    if (window.confirm("Are you sure you want to remove this system user?")) {
      startTransition(async () => {
        const result = await deleteEmployeeAction(selected.id);
        if (result?.error) {
          setFormError(result.error);
        } else {
          closeSheet();
        }
      });
    }
  };

  const handlePasswordReset = (email: string) => {
    if (confirm(`Send a password reset email to ${email}?`)) {
      startTransition(async () => {
        const result = await sendPasswordResetAction(email);
        if (result?.error) {
          alert(result.error);
        } else {
          alert(`Password reset email sent to ${email}`);
        }
      });
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
          {initialEmployees.length} employee{initialEmployees.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={openAdd}
          size="sm"
          className="h-9 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-[#26300D] text-[#FDCC4B] hover:bg-[#26300D]/90"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Employee
        </Button>
      </div>

      {/* ── Card List ── */}
      {initialEmployees.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <Users className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No employees yet</p>
          <p className="text-[11px] text-[#5F624F] mt-1">Add your first employee to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialEmployees.map((employee) => {
            const isActive = employee.status?.toLowerCase() === "active";
            return (
              <div
                key={employee.id}
                onClick={() => openView(employee)}
                className="bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:border-[#26300D]/30 hover:shadow-sm transition-all active:scale-[0.99]"
              >
                {/* Left: name + responsive meta */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[#1F1F1A] leading-snug sm:truncate">
                    {employee.full_name}
                  </p>

                  {/* Mobile: role + status badges */}
                  <div className="flex items-center gap-1.5 mt-1 sm:hidden flex-wrap">
                    <span className="text-[10px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-0.5 rounded-lg">
                      {employee.role || "No role"}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-lg border",
                      isActive
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-red-50 border-red-200 text-red-600"
                    )}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Desktop: email */}
                  <p className="hidden sm:block text-[11px] text-[#5F624F] font-medium truncate mt-0.5">
                    {employee.email}
                  </p>
                </div>

                {/* Desktop right: role + start date + status icon */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg">
                    {employee.role || "No role"}
                  </span>
                  <span className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(employee.start_date)}
                  </span>
                  {isActive
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                </div>

                <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════
          BOTTOM SHEET
      ══════════════════════════════ */}
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
          {/* Header */}
          <div className="shrink-0 px-6 py-4 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md z-30 sm:rounded-t-[2rem]">
            <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight">
              {isAdding ? "New Employee" : isEditing ? "Edit Employee" : (selected?.full_name ?? "")}
            </SheetTitle>
            {selected && !isEditing && (
              <div className="flex items-center gap-1.5 mt-1">
                <Hash className="w-3 h-3 text-[#5F624F]" />
                <span className="text-xs font-black text-[#5F624F] uppercase tracking-widest tabular-nums">
                  ID: {selected.id}
                </span>
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 touch-pan-y overscroll-contain space-y-4">

            {/* ── VIEW MODE ── */}
            {!showForm && selected && (() => {
              const isActive = selected.status?.toLowerCase() === "active";
              const phone = [selected.country_code, selected.phone_no].filter(Boolean).join(" ");
              return (
                <div className="space-y-4 animate-in fade-in duration-200">

                  {/* Status banner */}
                  <div className={cn(
                    "flex items-center gap-3 px-5 py-4 rounded-2xl border-2",
                    isActive ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  )}>
                    {isActive
                      ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                    <span className={cn(
                      "text-sm font-black uppercase tracking-widest",
                      isActive ? "text-green-700" : "text-red-600"
                    )}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y-2 divide-[#E6DFC8]">
                    {/* Row 1: Name + Role */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#E6DFC8]">
                      <DetailCell label="Full Name" value={selected.full_name} />
                      <DetailCell label="Role" value={selected.role || "—"} />
                    </div>
                    {/* Row 2: Email + Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#E6DFC8]">
                      <DetailCell label="Email" value={selected.email} />
                      <DetailCell label="Phone" value={phone || "—"} />
                    </div>
                    {/* Row 3: Start + End */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#E6DFC8]">
                      <DetailCell label="Started" value={formatDate(selected.start_date)} />
                      <DetailCell label="Left" value={formatDate(selected.end_date)} />
                    </div>
                  </div>

                  {/* Skeleton Staff */}
                  <div className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl border-2",
                    selected.is_skeleton_staff
                      ? "bg-amber-50 border-amber-200"
                      : "bg-[#F7F4EA] border-[#E6DFC8]"
                  )}>
                    <ShieldAlert className={cn(
                      "w-5 h-5 shrink-0",
                      selected.is_skeleton_staff ? "text-amber-600" : "text-[#5F624F] opacity-30"
                    )} />
                    <div className="flex-1">
                      <p className={cn(
                        "text-sm font-black",
                        selected.is_skeleton_staff ? "text-amber-700" : "text-[#5F624F]"
                      )}>
                        Skeleton Staff
                      </p>
                      <p className="text-[11px] text-[#5F624F] mt-0.5">
                        Essential staff for off-hours or special events
                      </p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black px-2.5 py-1 rounded-lg border shrink-0",
                      selected.is_skeleton_staff
                        ? "bg-amber-100 border-amber-300 text-amber-700"
                        : "bg-white border-[#E6DFC8] text-[#5F624F]"
                    )}>
                      {selected.is_skeleton_staff ? "YES" : "NO"}
                    </span>
                  </div>

                  {formError && <ErrorBox message={formError} />}
                </div>
              );
            })()}

            {/* ── EDIT / ADD FORM ── */}
            {showForm && (
              <form id="employee-form" action={handleSubmit} className="space-y-4 animate-in fade-in duration-200">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

                {/* Full Name */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    name="full_name"
                    placeholder="e.g. John Smith"
                    defaultValue={formDefault?.full_name ?? ""}
                    required
                    className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white focus-within:border-[#26300D] transition-all overflow-hidden">
                    <div className="flex items-center justify-center px-4 h-full border-r-2 border-[#E6DFC8] shrink-0">
                      <Mail className="w-4 h-4 text-[#5F624F]" />
                    </div>
                    <input
                      name="email"
                      type="email"
                      placeholder="e.g. john@company.com"
                      required
                      defaultValue={formDefault?.email ?? ""}
                      className="flex-1 h-full px-3 text-sm font-bold bg-transparent outline-none text-[#1F1F1A] placeholder:text-[#5F624F]/40"
                    />
                  </div>
                </div>

                {/* Role + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Role</Label>
                    <Input
                      name="role"
                      placeholder="e.g. Manager"
                      defaultValue={formDefault?.role ?? ""}
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Status</Label>
                    <Input
                      name="status"
                      placeholder="active / on leave"
                      defaultValue={formDefault?.status ?? ""}
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>
                </div>

                {/* Start Date + End Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                      Start Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="start_date"
                      type="date"
                      required
                      defaultValue={
                        formDefault?.start_date
                          ? new Date(formDefault.start_date).toISOString().split("T")[0]
                          : new Date().toISOString().split("T")[0]
                      }
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">End Date</Label>
                    <Input
                      name="end_date"
                      type="date"
                      defaultValue={
                        formDefault?.end_date
                          ? new Date(formDefault.end_date).toISOString().split("T")[0]
                          : ""
                      }
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                    Phone Number
                  </Label>
                  <div className="flex gap-3">
                    <div className="flex items-center h-14 w-24 rounded-2xl border-2 border-[#E6DFC8] bg-white focus-within:border-[#26300D] transition-all overflow-hidden shrink-0">
                      <div className="flex items-center justify-center px-3 h-full border-r-2 border-[#E6DFC8] shrink-0">
                        <Phone className="w-3.5 h-3.5 text-[#5F624F]" />
                      </div>
                      <input
                        name="country_code"
                        placeholder="+44"
                        defaultValue={formDefault?.country_code ?? ""}
                        className="flex-1 h-full px-2 text-sm font-bold bg-transparent outline-none text-[#1F1F1A] placeholder:text-[#5F624F]/40 w-0"
                      />
                    </div>
                    <input
                      name="phone_no"
                      type="tel"
                      placeholder="7123 456789"
                      defaultValue={formDefault?.phone_no ?? ""}
                      className="flex-1 h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all outline-none text-[#1F1F1A] placeholder:text-[#5F624F]/40"
                    />
                  </div>
                </div>

                {/* Skeleton Staff */}
                <div className="flex items-center justify-between bg-white border-2 border-[#E6DFC8] rounded-2xl px-5 py-4">
                  <div>
                    <p className="text-sm font-black text-[#1F1F1A]">Skeleton Staff</p>
                    <p className="text-[11px] text-[#5F624F] font-medium mt-0.5">
                      Essential staff for off-hours or special events
                    </p>
                  </div>
                  <input
                    title="Skeleton Staff"
                    type="checkbox"
                    name="is_skeleton_staff"
                    className="h-5 w-5 rounded accent-[#26300D] shrink-0 cursor-pointer"
                    defaultChecked={formDefault?.is_skeleton_staff ?? false}
                  />
                </div>

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-2" />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">

            {/* View mode: send reset + delete + edit */}
            {!showForm && selected && (
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => handlePasswordReset(selected.email)}
                  disabled={isPending}
                  title="Send password reset email"
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black bg-white hover:bg-[#F7F4EA]"
                >
                  <KeyRound className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black bg-white hover:bg-red-50 hover:border-red-200"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-2" />Edit
                </Button>
              </div>
            )}

            {/* Edit / Add mode */}
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
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">{label}</p>
      <p className="text-sm font-black text-[#1F1F1A] leading-snug break-words">{value}</p>
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
