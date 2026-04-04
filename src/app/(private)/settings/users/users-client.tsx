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
  Calendar,
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

const COUNTRY_CODES = [
  { code: "+93", country: "Afghanistan" },
  { code: "+355", country: "Albania" },
  { code: "+213", country: "Algeria" },
  { code: "+376", country: "Andorra" },
  { code: "+244", country: "Angola" },
  { code: "+1", country: "Antigua & Barbuda" },
  { code: "+54", country: "Argentina" },
  { code: "+374", country: "Armenia" },
  { code: "+61", country: "Australia" },
  { code: "+43", country: "Austria" },
  { code: "+994", country: "Azerbaijan" },
  { code: "+1", country: "Bahamas" },
  { code: "+973", country: "Bahrain" },
  { code: "+880", country: "Bangladesh" },
  { code: "+1", country: "Barbados" },
  { code: "+375", country: "Belarus" },
  { code: "+32", country: "Belgium" },
  { code: "+501", country: "Belize" },
  { code: "+229", country: "Benin" },
  { code: "+975", country: "Bhutan" },
  { code: "+591", country: "Bolivia" },
  { code: "+387", country: "Bosnia & Herzegovina" },
  { code: "+267", country: "Botswana" },
  { code: "+55", country: "Brazil" },
  { code: "+673", country: "Brunei" },
  { code: "+359", country: "Bulgaria" },
  { code: "+226", country: "Burkina Faso" },
  { code: "+257", country: "Burundi" },
  { code: "+855", country: "Cambodia" },
  { code: "+237", country: "Cameroon" },
  { code: "+1", country: "Canada" },
  { code: "+238", country: "Cape Verde" },
  { code: "+236", country: "Central African Republic" },
  { code: "+235", country: "Chad" },
  { code: "+56", country: "Chile" },
  { code: "+86", country: "China" },
  { code: "+57", country: "Colombia" },
  { code: "+269", country: "Comoros" },
  { code: "+243", country: "Congo (DRC)" },
  { code: "+242", country: "Congo (Republic)" },
  { code: "+506", country: "Costa Rica" },
  { code: "+385", country: "Croatia" },
  { code: "+53", country: "Cuba" },
  { code: "+357", country: "Cyprus" },
  { code: "+420", country: "Czech Republic" },
  { code: "+45", country: "Denmark" },
  { code: "+253", country: "Djibouti" },
  { code: "+1", country: "Dominica" },
  { code: "+1", country: "Dominican Republic" },
  { code: "+593", country: "Ecuador" },
  { code: "+20", country: "Egypt" },
  { code: "+503", country: "El Salvador" },
  { code: "+240", country: "Equatorial Guinea" },
  { code: "+291", country: "Eritrea" },
  { code: "+372", country: "Estonia" },
  { code: "+268", country: "Eswatini" },
  { code: "+251", country: "Ethiopia" },
  { code: "+679", country: "Fiji" },
  { code: "+358", country: "Finland" },
  { code: "+33", country: "France" },
  { code: "+241", country: "Gabon" },
  { code: "+220", country: "Gambia" },
  { code: "+995", country: "Georgia" },
  { code: "+49", country: "Germany" },
  { code: "+233", country: "Ghana" },
  { code: "+30", country: "Greece" },
  { code: "+1", country: "Grenada" },
  { code: "+502", country: "Guatemala" },
  { code: "+224", country: "Guinea" },
  { code: "+245", country: "Guinea-Bissau" },
  { code: "+592", country: "Guyana" },
  { code: "+509", country: "Haiti" },
  { code: "+504", country: "Honduras" },
  { code: "+36", country: "Hungary" },
  { code: "+354", country: "Iceland" },
  { code: "+91", country: "India" },
  { code: "+62", country: "Indonesia" },
  { code: "+98", country: "Iran" },
  { code: "+964", country: "Iraq" },
  { code: "+353", country: "Ireland" },
  { code: "+972", country: "Israel" },
  { code: "+39", country: "Italy" },
  { code: "+1", country: "Jamaica" },
  { code: "+81", country: "Japan" },
  { code: "+962", country: "Jordan" },
  { code: "+7", country: "Kazakhstan" },
  { code: "+254", country: "Kenya" },
  { code: "+686", country: "Kiribati" },
  { code: "+383", country: "Kosovo" },
  { code: "+965", country: "Kuwait" },
  { code: "+996", country: "Kyrgyzstan" },
  { code: "+856", country: "Laos" },
  { code: "+371", country: "Latvia" },
  { code: "+961", country: "Lebanon" },
  { code: "+266", country: "Lesotho" },
  { code: "+231", country: "Liberia" },
  { code: "+218", country: "Libya" },
  { code: "+423", country: "Liechtenstein" },
  { code: "+370", country: "Lithuania" },
  { code: "+352", country: "Luxembourg" },
  { code: "+261", country: "Madagascar" },
  { code: "+265", country: "Malawi" },
  { code: "+60", country: "Malaysia" },
  { code: "+960", country: "Maldives" },
  { code: "+223", country: "Mali" },
  { code: "+356", country: "Malta" },
  { code: "+692", country: "Marshall Islands" },
  { code: "+222", country: "Mauritania" },
  { code: "+230", country: "Mauritius" },
  { code: "+52", country: "Mexico" },
  { code: "+691", country: "Micronesia" },
  { code: "+373", country: "Moldova" },
  { code: "+377", country: "Monaco" },
  { code: "+976", country: "Mongolia" },
  { code: "+382", country: "Montenegro" },
  { code: "+212", country: "Morocco" },
  { code: "+258", country: "Mozambique" },
  { code: "+95", country: "Myanmar" },
  { code: "+264", country: "Namibia" },
  { code: "+674", country: "Nauru" },
  { code: "+977", country: "Nepal" },
  { code: "+31", country: "Netherlands" },
  { code: "+64", country: "New Zealand" },
  { code: "+505", country: "Nicaragua" },
  { code: "+227", country: "Niger" },
  { code: "+234", country: "Nigeria" },
  { code: "+850", country: "North Korea" },
  { code: "+389", country: "North Macedonia" },
  { code: "+47", country: "Norway" },
  { code: "+968", country: "Oman" },
  { code: "+92", country: "Pakistan" },
  { code: "+680", country: "Palau" },
  { code: "+970", country: "Palestine" },
  { code: "+507", country: "Panama" },
  { code: "+675", country: "Papua New Guinea" },
  { code: "+595", country: "Paraguay" },
  { code: "+51", country: "Peru" },
  { code: "+63", country: "Philippines" },
  { code: "+48", country: "Poland" },
  { code: "+351", country: "Portugal" },
  { code: "+974", country: "Qatar" },
  { code: "+40", country: "Romania" },
  { code: "+7", country: "Russia" },
  { code: "+250", country: "Rwanda" },
  { code: "+1", country: "Saint Kitts & Nevis" },
  { code: "+1", country: "Saint Lucia" },
  { code: "+1", country: "Saint Vincent" },
  { code: "+685", country: "Samoa" },
  { code: "+378", country: "San Marino" },
  { code: "+239", country: "São Tomé & Príncipe" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+221", country: "Senegal" },
  { code: "+381", country: "Serbia" },
  { code: "+248", country: "Seychelles" },
  { code: "+232", country: "Sierra Leone" },
  { code: "+65", country: "Singapore" },
  { code: "+421", country: "Slovakia" },
  { code: "+386", country: "Slovenia" },
  { code: "+677", country: "Solomon Islands" },
  { code: "+252", country: "Somalia" },
  { code: "+27", country: "South Africa" },
  { code: "+82", country: "South Korea" },
  { code: "+211", country: "South Sudan" },
  { code: "+34", country: "Spain" },
  { code: "+94", country: "Sri Lanka" },
  { code: "+249", country: "Sudan" },
  { code: "+597", country: "Suriname" },
  { code: "+46", country: "Sweden" },
  { code: "+41", country: "Switzerland" },
  { code: "+963", country: "Syria" },
  { code: "+886", country: "Taiwan" },
  { code: "+992", country: "Tajikistan" },
  { code: "+255", country: "Tanzania" },
  { code: "+66", country: "Thailand" },
  { code: "+670", country: "Timor-Leste" },
  { code: "+228", country: "Togo" },
  { code: "+676", country: "Tonga" },
  { code: "+1", country: "Trinidad & Tobago" },
  { code: "+216", country: "Tunisia" },
  { code: "+90", country: "Turkey" },
  { code: "+993", country: "Turkmenistan" },
  { code: "+688", country: "Tuvalu" },
  { code: "+256", country: "Uganda" },
  { code: "+380", country: "Ukraine" },
  { code: "+971", country: "UAE" },
  { code: "+44", country: "United Kingdom" },
  { code: "+1", country: "United States" },
  { code: "+598", country: "Uruguay" },
  { code: "+998", country: "Uzbekistan" },
  { code: "+678", country: "Vanuatu" },
  { code: "+379", country: "Vatican City" },
  { code: "+58", country: "Venezuela" },
  { code: "+84", country: "Vietnam" },
  { code: "+967", country: "Yemen" },
  { code: "+260", country: "Zambia" },
  { code: "+263", country: "Zimbabwe" },
];

export default function EmployeesClient({ initialEmployees = [] }: { initialEmployees: EmployeeRecord[] }) {
  const { confirm, ConfirmDialogUI } = useConfirm();
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
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
            const empStatus = employee.status?.toLowerCase();
            const isActive = empStatus === "active";
            const isLeave = empStatus === "leave";
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
                      isActive ? "bg-green-50 border-green-200 text-green-700"
                        : isLeave ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-red-50 border-red-200 text-red-600"
                    )}>
                      {isActive ? "Active" : isLeave ? "On Leave" : "Inactive"}
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
                    : isLeave
                    ? <XCircle className="w-4 h-4 text-amber-400" />
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
            <div className="flex items-start justify-between gap-3">
              {/* Left: title + ID */}
              <div className="min-w-0">
                <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                  {isAdding ? "New Employee" : isEditing ? "Edit Employee" : "View Employee"}
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

              {/* Right: reset password — view mode only */}
              {!showForm && selected && (
                <Button
                  variant="ghost"
                  onClick={() => handlePasswordReset(selected.email)}
                  disabled={isPending}
                  title="Send password reset email"
                  className="shrink-0 h-10 px-3 rounded-xl border-2 border-[#E6DFC8] text-[#5F624F] font-black bg-white hover:bg-[#F7F4EA] text-[10px] uppercase tracking-widest flex items-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span className="sm:inline">Reset Password</span>
                </Button>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 touch-pan-y overscroll-contain space-y-4">

            {/* ── VIEW MODE ── */}
            {!showForm && selected && (() => {
              const status = selected.status?.toLowerCase();
              const isActive = status === "active";
              const isLeave = status === "leave";
              const phone = [selected.country_code, selected.phone_no].filter(Boolean).join(" ");
              return (
                <div className="space-y-4 animate-in fade-in duration-200">

                  {/* Status banner */}
                  <div className={cn(
                    "flex items-center gap-3 px-5 py-4 rounded-2xl border-2",
                    isActive ? "bg-green-50 border-green-200"
                      : isLeave ? "bg-amber-50 border-amber-200"
                      : "bg-red-50 border-red-200"
                  )}>
                    {isActive
                      ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      : <XCircle className={cn("w-5 h-5 shrink-0", isLeave ? "text-amber-500" : "text-red-500")} />}
                    <span className={cn(
                      "text-sm font-black uppercase tracking-widest",
                      isActive ? "text-green-700" : isLeave ? "text-amber-700" : "text-red-600"
                    )}>
                      {isActive ? "Active" : isLeave ? "On Leave" : "Inactive"}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y-2 divide-[#E6DFC8]">
                    {/* Row 1: Name + Role */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#E6DFC8]">
                      <DetailCell label="Full Name" value={selected.full_name} />
                      <DetailCell label="Status" value={toTitleCase(selected.status) || "—"} />
                      
                    </div>
                    {/* Row 2: Start + End */}  
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#E6DFC8]">
                    <DetailCell label="Role" value={toTitleCase(selected.role) || "—"} />
                    <DetailCell label="Contract" value={toTitleCase(selected.employment_type?.replace("-", " ")) || "—"} />                      
                    </div>
                    {/* Row 2: Start + End */}                    
                    <div className="grid grid-cols-2 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#E6DFC8]">
                      <DetailCell label="Started" value={formatDate(selected.start_date)} />
                      <DetailCell label="Left" value={formatDate(selected.end_date)} />
                    </div>
                     {/* Row 3: Email + Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#E6DFC8]">
                      <DetailCell label="Email" value={selected.email} />
                      <DetailCell label="Phone" value={phone || "—"} />
                    </div>
                    <DetailCell label="Birthday" value={formatDate(selected.birthday)} />
                  </div>

                  {/* Account Access */}
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y-2 divide-[#E6DFC8]">
                    <div className="px-4 py-2.5 bg-[#F7F4EA]">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        Account Access
                      </p>
                    </div>
                    <div className="grid grid-cols-2 divide-x-2 divide-[#E6DFC8]">
                      <DetailCell
                        label="Invite Sent"
                        value={selected.invite_sent_at ? formatDate(selected.invite_sent_at) : "Not sent"}
                      />
                      <DetailCell
                        label="Invite Accepted"
                        value={selected.invite_accepted_at ? formatDate(selected.invite_accepted_at) : selected.invite_sent_at ? "Pending" : "—"}
                      />
                    </div>
                    <DetailCell
                      label="Password Reset Sent"
                      value={selected.password_reset_sent_at ? formatDate(selected.password_reset_sent_at) : "—"}
                    />
                  </div>

                  {/* Skeleton Staff */}
                  {/* <div className={cn(
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
                  </div> */}

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

                {/* Status + Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Status</Label>
                    <div className="relative">
                      <select
                        title="Status"
                        name="status"
                        defaultValue={formDefault?.status ?? "active"}
                        className="w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-black tracking-widest outline-none focus:border-[#26300D] appearance-none"
                      >
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F]/30 rotate-90 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Role</Label>
                    <Input
                      name="role"
                      placeholder="e.g. Manager"
                      defaultValue={formDefault?.role ?? ""}
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>
                </div>

                {/* Contract Type */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Contract Type</Label>
                  <div className="relative">
                    <select
                      title="Employment Type"
                      name="employment_type"
                      defaultValue={formDefault?.employment_type ?? "full-time"}
                      className="w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-black tracking-widest outline-none focus:border-[#26300D] appearance-none"
                    >
                      {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F]/30 rotate-90 pointer-events-none" />
                  </div>
                </div>

                {/* Start Date + End Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 min-w-0">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                      Started <span className="text-red-500">*</span>
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
                      className="h-14 w-full rounded-2xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Left</Label>
                    <Input
                      name="end_date"
                      type="date"
                      defaultValue={
                        formDefault?.end_date
                          ? new Date(formDefault.end_date).toISOString().split("T")[0]
                          : ""
                      }
                      className="h-14 w-full rounded-2xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>
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

                {/* Country Code + Phone */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                    Phone Number
                  </Label>
                  <div className="flex gap-3">
                    <div className="relative shrink-0 w-30">
                      <select
                        title="Country Code"
                        name="country_code"
                        defaultValue={formDefault?.country_code ?? "+44"}
                        className="w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white pl-3 pr-7 text-sm font-bold outline-none focus:border-[#26300D] appearance-none text-[#1F1F1A]"
                      >
                        {COUNTRY_CODES.map((c, i) => (
                          <option key={i} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                      <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F]/30 rotate-90 pointer-events-none" />
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

                {/* Birthday */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Birthday</Label>
                  <Input
                    name="birthday"
                    type="date"
                    defaultValue={
                      formDefault?.birthday
                        ? new Date(formDefault.birthday).toISOString().split("T")[0]
                        : ""
                    }
                    className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
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
              <div className="grid grid-cols-2 gap-3">
               
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 px-4 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-widest text-[10px] bg-white hover:bg-red-50 hover:border-red-200"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Delete
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
      {ConfirmDialogUI}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">{label}</p>
      <p className="text-sm font-black text-[#1F1F1A] leading-snug wrap-break-word">{value}</p>
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

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}
