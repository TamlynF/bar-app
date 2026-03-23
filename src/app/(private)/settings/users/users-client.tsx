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
import { Plus, Edit2, Trash2, Loader2, Briefcase, Mail, Phone, Calendar, ShieldAlert } from "lucide-react";
import { saveEmployeeAction, deleteEmployeeAction } from "./actions";

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
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  
  const [isPending, startTransition] = useTransition();

  const handleOpenEdit = (employee: EmployeeRecord) => {
    setEditingEmployee(employee);
    setIsSheetOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setIsSheetOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to remove this system user?")) {
      startTransition(async () => {
        const result = await deleteEmployeeAction(id);
        if (result?.error) {
          alert(result.error);
        }
      });
    }
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveEmployeeAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        setIsSheetOpen(false); // Close sheet on success
      }
    });
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-medium">System Users & Employees</h3>
          <p className="text-sm text-muted-foreground">
            Manage your staff, assign roles, and track employment periods.
          </p>
        </div>
        
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
                {/* Full Name & Email */}
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

                {/* Role & Status */}
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

                {/* Employment Dates */}
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

                {/* Phone Number (Code + No) */}
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

                {/* Birthday */}
                <div className="space-y-2">
                  <Label htmlFor="birthday">Birthday</Label>
                  <Input 
                    id="birthday" 
                    name="birthday" 
                    type="date"
                    defaultValue={editingEmployee?.birthday ? new Date(editingEmployee.birthday).toISOString().split('T')[0] : ""} 
                  />
                </div>

                {/* Skeleton Staff Checkbox */}
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
      </div>

      <div className="mt-6">
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
      </div>
    </div>
  );
}