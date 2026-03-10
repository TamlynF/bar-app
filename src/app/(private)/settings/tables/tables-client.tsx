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
  Users
} from "lucide-react";
import { saveTableAction, deleteTableAction } from "./actions";
import { cn } from "@/lib/utils";

export type Table = {
  id: number;
  name: string;
  max_capacity: number;
  available: boolean;
};

export default function TablesClient({ initialTables = [] }: { initialTables: Table[] }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null); 
  const [isPending, startTransition] = useTransition();

  const handleOpenEdit = (table: Table) => {
    setEditingTable(table);
    setIsSheetOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingTable(null);
    setIsSheetOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this table?")) {
      startTransition(async () => {
        const result = await deleteTableAction(id);
        if (result?.error) {
          alert(result.error);
        }
      });
    }
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveTableAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        setIsSheetOpen(false);
      }
    });
  };

  return (
    <div className="p-4">
      {/* Page Information Section */}
      <div className="pb-4 border-b">
        <p className="text-sm text-muted-foreground font-medium">
          Manage your physical tables and their maximum capacities.
        </p>
      </div>

      {/* Action Section - Positioned under the line */}
      <div className="mt-4">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <Button onClick={handleOpenAdd} size="sm" className="font-bold uppercase tracking-wider">
            <Plus className="w-4 h-4 mr-2" />
            Add Table
          </Button>
          
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{editingTable ? "Edit Table" : "Add New Table"}</SheetTitle>
              <SheetDescription>
                {editingTable 
                  ? "Update the details for this table below." 
                  : "Enter the details for your new table. It will be immediately available for bookings."}
              </SheetDescription>
            </SheetHeader>
            
            <form action={handleSubmit} className="flex flex-col h-full mt-6">
              {editingTable && <input type="hidden" name="id" value={editingTable.id} />}
              
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <Label htmlFor="name">Table Name / Identifier</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="e.g. Window Booth 1" 
                    defaultValue={editingTable?.name || ""} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Max Capacity</Label>
                  <Input 
                    id="capacity" 
                    name="capacity" 
                    type="number" 
                    min={1} 
                    placeholder="e.g. 4" 
                    required
                    defaultValue={editingTable?.max_capacity || ""} 
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8 pb-4">
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
                  {editingTable ? "Update Table" : "Save Table"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Table Data Section - Wrapped for horizontal scroll on mobile */}
      <div className="mt-6 border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[500px] sm:min-w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-3 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">No.</th>
                <th className="px-3 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Max Capacity</th>
                <th className="px-3 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Available</th>
                <th className="px-3 py-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialTables.map((table) => (
                <tr key={table.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-3 py-3 font-bold text-foreground">
                    {table.name || `Table ${table.id}`}
                  </td>
                  <td className="px-3 py-3">
                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-secondary text-secondary-foreground border border-secondary-foreground/10">
                      <Users className="w-3.5 h-3.5 opacity-70" />
                      {table.max_capacity}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {table.available !== false ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-xs uppercase tracking-tight">
                        <CheckCircle2 className="w-4 h-4" />
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-destructive font-bold text-xs uppercase tracking-tight">
                        <XCircle className="w-4 h-4" />
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end">
                      {/* Desktop Actions: sm screens and up */}
                      <div className="hidden sm:flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(table)}
                          disabled={isPending}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(table.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Mobile Actions: 3-dot menu for smaller screens */}
                      <div className="sm:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground rounded-full">
                              <MoreVertical className="w-5 h-5" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-9999 w-32">
                            <DropdownMenuItem onClick={() => handleOpenEdit(table)} className="font-bold text-xs uppercase tracking-wide">
                              <Edit2 className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive font-bold text-xs uppercase tracking-wide" 
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
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground italic">
                    No tables configured yet.
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