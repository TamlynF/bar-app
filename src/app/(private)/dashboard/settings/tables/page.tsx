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
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { saveTableAction, deleteTableAction } from "./actions";

export type Table = {
  id: number;
  name: string;
  max_capacity: number;
};

export default function TablesClient({ initialTables }: { initialTables: Table[] }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  
  // useTransition handles the loading state while server actions are running
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
        setIsSheetOpen(false); // Close sheet on success
      }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-medium">Table Setups</h3>
          <p className="text-sm text-muted-foreground">
            Manage your physical tables and their maximum capacities.
          </p>
        </div>
        
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <Button onClick={handleOpenAdd} size="sm">
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
            
            {/* Action automatically converts to a FormData payload on submit */}
            <form action={handleSubmit} className="flex flex-col h-full mt-6">
              {/* Hidden ID field for updates */}
              {editingTable && <input type="hidden" name="id" value={editingTable.id} />}
              
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <Label htmlFor="name">Table Name / Identifier</Label>
                  <Input 
                    id="name" 
                    name="name" // The 'name' attribute is what formData uses
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

      <div className="mt-6">
        <div className="rounded-md border">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Table Name</th>
                <th className="px-4 py-3 font-medium">Max Capacity</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialTables.map((table) => (
                <tr key={table.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{table.name || `Table ${table.id}`}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      {table.max_capacity} Guests
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(table)}
                        disabled={isPending}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(table.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {initialTables.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
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