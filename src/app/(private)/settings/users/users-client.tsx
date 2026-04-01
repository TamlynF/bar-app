"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Edit2, Trash2, Loader2, Briefcase, Mail, Phone, Calendar, ShieldAlert, KeyRound, LayoutDashboard, Users, XCircle, CheckCircle2, ChevronRight, Save, Pencil, Hash, AlertCircle } from "lucide-react";
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
  //const [isSheetOpen, setIsSheetOpen] = useState(false);
  //const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  
    // ── Sheet helpers ─────────────────────────────────────────────────────────
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
  
    // ── Actions ───────────────────────────────────────────────────────────────
  const handleSubmit = (formData: FormData) => {
      setFormError(null);
    startTransition(async () => {
      const result = await saveEmployeeAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet(); // Close sheet on success
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
  
  // const handleOpenEdit = (employee: EmployeeRecord) => {
  //   setEditingEmployee(employee);
  //   setIsSheetOpen(true);
  // };

  // const handleOpenAdd = () => {
  //   setEditingEmployee(null);
  //   setIsSheetOpen(true);
  // };

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




  // Helper to safely format dates
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
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
          <LayoutDashboard className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No employees yet</p>
          <p className="text-[11px] text-[#5F624F] mt-1">
            Add your first employee to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialEmployees.map((employee) => (
            <div
              key={employee.id}
              onClick={() => openView(employee)}
              className="bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:border-[#26300D]/30 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              {/* Icon */}
              {/* <div className="w-10 h-10 rounded-xl bg-[#F7F4EA] flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-4 h-4 text-[#26300D]" />
              </div> */}

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#1F1F1A] truncate">{employee.full_name}</p>
                {employee.email && (
                  <p className="text-[11px] text-[#5F624F] font-medium truncate mt-0.5">
                    {employee.email}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg">
                  <Users className="w-3 h-3" />
                  {employee.role || "No role"}
                </span>
                {employee.status ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
            </div>
          ))}
        </div>
      )}
      
       {/* ══════════════════════════════
          BOTTOM SHEET
      ══════════════════════════════ */}
      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85dvh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[520px]
            sm:h-auto sm:max-h-[80dvh] sm:rounded-[2rem] sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sticky header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
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
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 touch-pan-y space-y-5">

            {/* ── VIEW MODE ── */}
            {!showForm && selected && (
              <div className="space-y-5 animate-in fade-in duration-200 sm:flex sm:flex-col sm:items-center">
                <div className="w-full sm:max-w-sm space-y-5">
                  <div className={cn(
                    "flex items-center gap-3 px-5 py-4 rounded-2xl border-2",
                    selected.status == "active"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  )}>
                    {selected.status == "active" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm font-black uppercase tracking-widest",
                      selected.status == "active" ? "text-green-700" : "text-red-600"
                    )}>
                      {selected.status == "active" ? "Available for booking" : "Not available"}
                    </span>
                  </div>

                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <DetailRow label="Employee Name" value={selected.full_name} />
                    <DetailRow
                      label="Email Address"
                      value={selected.email}
                      icon={<Mail className="w-4 h-4" />}
                    />
                    {selected.phone_no && (
                      <DetailRow label="Phone Number" value={selected.phone_no} icon={<Phone className="w-4 h-4" />} />
                    )}
                  </div>

                  {formError && <ErrorBox message={formError} />}
                </div>
              </div>
            )}

            {/* ── EDIT / ADD FORM ── */}
            {showForm && (
              <form
                id="table-form"
                action={handleSubmit}
                className="animate-in fade-in duration-200"
              >
                {formDefault && (
                  <input type="hidden" name="id" value={formDefault.id} />
                )}

                {/* Mobile: stacked · Desktop: 2-column grid */}
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">

                  {/* Table Name — full width */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                      Employee Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="name"
                      placeholder="e.g. John Doe"
                      defaultValue={formDefault?.full_name ?? ""}
                      required
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>

                  {/* Max Capacity */}
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
                        placeholder="e.g. john.doe@example.com"
                        required
                        defaultValue={formDefault?.email ?? ""}
                        className="flex-1 h-full px-3 text-sm font-bold bg-transparent outline-none text-[#1F1F1A] placeholder:text-[#5F624F]/40"
                      />
                    </div>
                  </div>

                  {/* Available checkbox — beside capacity on desktop */}
                  {/* <div className="flex items-center justify-between bg-white border-2 border-[#E6DFC8] rounded-2xl px-5 py-4">
                    <div>
                      <p className="text-sm font-black text-[#1F1F1A]">Status</p>
                      <p className="text-[11px] text-[#5F624F] font-medium mt-0.5">
                        Allow this user to be active
                      </p>
                    </div>
                    <input
                      title="Available for booking"
                      type="checkbox"
                      name="available"
                      className="h-5 w-5 rounded accent-[#26300D] shrink-0 cursor-pointer"
                      defaultChecked={formDefault ? formDefault.available : true}
                    />
                  </div> */}

                  {/* Location / Notes — full width */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">
                      Role & Status
                    </Label>
                    <Input
                      name="role"
                      placeholder="e.g. Manager"
                      defaultValue={formDefault?.role ?? ""}
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#26300D] transition-all"
                    />
                  </div>

                  {formError && (
                    <div className="sm:col-span-2">
                      <ErrorBox message={formError} />
                    </div>
                  )}
                </div>
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 p-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">

            {/* View mode */}
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3 sm:max-w-sm sm:mx-auto">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#26300D] font-black uppercase tracking-[0.1em] text-[10px] bg-white"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Trash2 className="w-4 h-4 mr-2" />Delete</>
                  )}
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-2" />Edit
                </Button>
              </div>
            )}

            {/* Edit / Add mode */}
            {showForm && (
              <div className="grid grid-cols-2 gap-3 sm:max-w-sm sm:mx-auto">
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
                  form="table-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Save</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
       {/* <div className="flex items-center justify-between pb-4 border-b">
        
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <Button onClick={handleOpenAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
          
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</SheetTitle>
              <SheetDescription>
                {editingEmployee 
                  ? "Update the details and permissions for this staff member." 
                  : "Enter the details for a new staff member."}
              </SheetDescription>
            </SheetHeader>
            
            <form action={handleSubmit} className="flex flex-col h-full mt-6">
              {editingEmployee && <input type="hidden" name="id" value={editingEmployee.id} />}
              
              <div className="space-y-4 flex-1 pb-8">
                 <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="full_name" 
                    name="full_name" 
                    placeholder="e.g. John Smith" 
                    defaultValue={editingEmployee?.full_name || ""} 
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email"
                    placeholder="e.g. john@company.com" 
                    defaultValue={editingEmployee?.email || ""} 
                    required
                  />
                </div>

                <div className="flex gap-4">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="role">Role</Label>
                    <Input 
                      id="role" 
                      name="role" 
                      placeholder="e.g. Manager, Bartender" 
                      defaultValue={editingEmployee?.role || ""} 
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="status">Status</Label>
                    <Input 
                      id="status" 
                      name="status" 
                      placeholder="e.g. Active, Leave" 
                      defaultValue={editingEmployee?.status || ""} 
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="start_date">Start Date <span className="text-destructive">*</span></Label>
                    <Input 
                      id="start_date" 
                      name="start_date" 
                      type="date"
                      required
                      defaultValue={editingEmployee?.start_date ? new Date(editingEmployee.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} 
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input 
                      id="end_date" 
                      name="end_date" 
                      type="date"
                      defaultValue={editingEmployee?.end_date ? new Date(editingEmployee.end_date).toISOString().split('T')[0] : ""} 
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="space-y-2 w-1/3">
                    <Label htmlFor="country_code">Code</Label>
                    <Input 
                      id="country_code" 
                      name="country_code" 
                      placeholder="+44" 
                      defaultValue={editingEmployee?.country_code || ""} 
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="phone_no">Phone Number</Label>
                    <Input 
                      id="phone_no" 
                      name="phone_no" 
                      type="tel"
                      placeholder="e.g. 7123 456789" 
                      defaultValue={editingEmployee?.phone_no || ""} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthday">Birthday</Label>
                  <Input 
                    id="birthday" 
                    name="birthday" 
                    type="date"
                    defaultValue={editingEmployee?.birthday ? new Date(editingEmployee.birthday).toISOString().split('T')[0] : ""} 
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t mt-4">
                  <Input 
                    type="checkbox" 
                    id="is_skeleton_staff" 
                    name="is_skeleton_staff"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    defaultChecked={editingEmployee?.is_skeleton_staff || false}
                  />
                  <Label htmlFor="is_skeleton_staff" className="cursor-pointer font-medium">
                    Skeleton Staff
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Check this if the employee operates as essential/skeleton staff during off-hours or special events.
                </p>
              </div>
              
              {editingEmployee && (editingEmployee.created_at || editingEmployee.updated_at) && (
                <div className="pt-4 border-t mt-2 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Record Activity</p>
                  {editingEmployee.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(editingEmployee.created_at)}
                      {editingEmployee.created_by_employee && ` by ${editingEmployee.created_by_employee.full_name}`}
                    </p>
                  )}
                  {editingEmployee.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Last updated {formatDate(editingEmployee.updated_at)}
                      {editingEmployee.updated_by_employee && ` by ${editingEmployee.updated_by_employee.full_name}`}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsSheetOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingEmployee ? "Update Employee" : "Save Employee"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>  */}

      {/* <div className="mt-6">
        <div className="rounded-md border">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Role & Status</th>
                <th className="px-4 py-3 font-medium">Employment Dates</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground block">{emp.full_name}</span>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5">
                          <Mail className="w-3 h-3" />
                          <span>{emp.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      {emp.role ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {emp.role}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No role</span>
                      )}
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {emp.status || "Active"}
                        </span>
                        {emp.is_skeleton_staff && (
                          <span className="flex items-center text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="Skeleton Staff">
                            <ShieldAlert className="w-3 h-3 mr-1" /> Skeleton
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        <span>Started: <strong className="font-medium text-foreground">{formatDate(emp.start_date)}</strong></span>
                      </div>
                      {emp.end_date && (
                        <div className="flex items-center gap-1.5 pl-4.5">
                          <span className="opacity-0">-</span>
                          <span>Ended: <strong className="font-medium text-foreground">{formatDate(emp.end_date)}</strong></span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handlePasswordReset(emp.email)}
                        disabled={isPending}
                        title="Send password reset email"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(emp)}
                        disabled={isPending}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(emp.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {initialEmployees.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    <Briefcase className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    No employees found. Add your first staff member to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div> */}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
          {label}
        </span>
      </div>
      <span className="text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug">
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
