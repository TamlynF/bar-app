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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  MoreVertical, 
  Users,
  LayoutDashboard,
  AlertCircle
} from "lucide-react";
import { saveTableAction, deleteTableAction } from "./actions";

export type Table = {
  id: number;
  name: string;
  max_capacity: number;
  available: boolean;
  description: string | null;
};

export default function TablesClient({ initialTables = [] }: { initialTables: Table[] }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null); 
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenEdit = (table: Table) => {
    setFormError(null);
    setEditingTable(table);
    setIsSheetOpen(true);
  };

  const handleOpenAdd = () => {
    setFormError(null);
    setEditingTable(null);
    setIsSheetOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this table? This cannot be undone if the table has no associated history.")) {
      startTransition(async () => {
        const result = await deleteTableAction(id);
        if (result?.error) {
          alert(result.error);
        }
      });
    }
  };

  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveTableAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        setIsSheetOpen(false);
      }
    });
  };

  return (
    <div className="p-6 sm:p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="pr-4">
          <p className="text-xs text-muted-foreground line-clamp-1">
            Manage floor plan and seat capacities.
          </p>
        </div>
      </div>

      {/* Sheet Modal */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => {
        setIsSheetOpen(open);
        if (!open) setFormError(null);
      }}>
        <SheetContent side="right" className="w-full sm:max-w-md h-full flex flex-col p-0 gap-0 border-l border-border/50">
          <SheetHeader className="px-6 pt-6 pb-4 text-left border-b border-border/40 shrink-0">
            <SheetTitle className="text-xl font-bold">
              {editingTable ? "Edit Table" : "Add New Table"}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {editingTable 
                ? "Update the configuration for this physical table." 
                : "Define a new table for your reservation system."}
            </SheetDescription>
          </SheetHeader>
          
          <form action={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background/50">
            {editingTable && <input type="hidden" name="id" value={editingTable.id} />}
            
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Table Number */}
              <div className="space-y-3">
                <Label htmlFor="name" className="text-sm font-semibold">Table No. <span className="text-destructive">*</span></Label>
                <Input 
                  id="name" 
                  name="name" 
                  placeholder="e.g. Window Booth 1" 
                  defaultValue={editingTable?.name || ""} 
                  required
                  className="h-11 rounded-xl shadow-sm bg-white dark:bg-slate-900"
                />
              </div>

              {/* Max Capacity */}
              <div className="space-y-3">
                <Label htmlFor="capacity" className="text-sm font-semibold">Max Capacity <span className="text-destructive">*</span></Label>
                <div className="relative group">
                  <Input 
                    id="capacity" 
                    name="capacity" 
                    type="number" 
                    min={1} 
                    placeholder="e.g. 4" 
                    required
                    defaultValue={editingTable?.max_capacity || ""} 
                    className="h-11 rounded-xl pl-10 shadow-sm bg-white dark:bg-slate-900"
                  />
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-[11px] text-muted-foreground italic px-1">
                  The maximum number of guests this table can accommodate.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-semibold">Location / Description</Label>
                <Input 
                  id="description" 
                  name="description" 
                  placeholder="e.g. Near the fireplace, quiet corner..." 
                  defaultValue={editingTable?.description || ""} 
                  className="h-11 rounded-xl shadow-sm bg-white dark:bg-slate-900"
                />
              </div>

              {/* Availability Toggle */}
              <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="available" className="text-sm font-bold">Currently Available</Label>
                    <p className="text-xs text-muted-foreground">Allow this table to be booked.</p>
                  </div>
                  <Input 
                    type="checkbox" 
                    id="available" 
                    name="available"
                    className="h-6 w-6 rounded-lg border-primary/20 accent-[#26300D]"
                    defaultChecked={editingTable ? editingTable.available : true}
                  />
                </div>
              </div>

              {/* Error Display */}
              {formError && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive font-medium leading-snug">{formError}</p>
                </div>
              )}
            </div>
            
            {/* Fixed Footer */}
            <div className="shrink-0 border-t border-border/40 bg-card/95 backdrop-blur p-4 pb-10 sm:pb-4 sm:px-6 flex flex-row justify-end gap-3 z-10">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsSheetOpen(false)}
                disabled={isPending}
                className="flex-1 sm:flex-none h-11 rounded-xl font-bold uppercase tracking-wider text-[10px]"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="flex-1 sm:flex-none h-11 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-md">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingTable ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Data Table */}
      <div className="mt-6 border rounded-2xl overflow-hidden bg-card shadow-sm transition-all border-[#E6DFC8]">
        {/* Table Toolbar */}
        <div className="p-3 border-b border-[#E6DFC8] bg-muted/5 flex items-center justify-between">
           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1"></span>
           <Button onClick={handleOpenAdd} size="sm" className="font-bold uppercase tracking-wider text-[10px] h-8 px-3 rounded-xl">
             <Plus className="w-3.5 h-3.5 mr-1.5" />
             Add
           </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[320px]">
            <thead className="bg-muted/30 border-b border-[#E6DFC8]">
              <tr>
                <th className="px-2 sm:px-4 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground">No.</th>
                <th className="px-2 sm:px-4 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground text-center">Capacity</th>
                <th className="px-2 sm:px-4 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground">Available</th>
                <th className="px-2 sm:px-4 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {initialTables.map((table) => (
                <tr key={table.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-2 sm:px-4 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-foreground truncate max-w-[100px] sm:max-w-none">
                        {table.name || `Table ${table.id}`}
                      </span>
                      {table.description && (
                        <span className="text-[11px] text-muted-foreground line-clamp-1 italic font-medium hidden sm:block">
                          {table.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-4 text-center">
                   <span className="inline-flex items-center gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-secondary text-secondary-foreground border border-secondary-foreground/10">
                      <Users className="w-3 h-3 opacity-70 hidden xs:block" />
                      {table.max_capacity}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-4">
                    {table.available !== false ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-destructive font-bold text-[9px] sm:text-[10px] uppercase tracking-wider">
                        <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Desktop Actions */}
                      <div className="hidden sm:flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(table)}
                          disabled={isPending}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(table.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Mobile Actions: 3-dot menu for smaller screens */}
                      <div className="sm:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-9999 w-32" style={{ backgroundColor: "#E2EDBF" }}>
                            <DropdownMenuItem onClick={() => handleOpenEdit(table)} className="font-bold text-xs uppercase">
                              <Edit2 className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive font-bold text-xs uppercase" 
                              onClick={() => handleDelete(table.id)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {initialTables.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <LayoutDashboard className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground italic">No tables configured yet.</p>
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
