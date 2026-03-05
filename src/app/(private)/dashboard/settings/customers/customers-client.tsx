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
import { Plus, Edit2, Trash2, Loader2, User, Mail, Phone, Cake } from "lucide-react";
import { saveContactAction, deleteContactAction } from "./actions";

export type ContactRecord = {
  id: number;
  full_name: string;
  email: string;
  country_code: string | null;
  phone_no: string | null;
  birthday: string | null;
  created_at?: string;
};

export default function CustomersClient({ initialContacts = [] }: { initialContacts: ContactRecord[] }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  
  const [isPending, startTransition] = useTransition();

  const handleOpenEdit = (contact: ContactRecord) => {
    setEditingContact(contact);
    setIsSheetOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingContact(null);
    setIsSheetOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this customer contact?")) {
      startTransition(async () => {
        const result = await deleteContactAction(id);
        if (result?.error) {
          alert(result.error);
        }
      });
    }
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveContactAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        setIsSheetOpen(false); // Close sheet on success
      }
    });
  };

  // Helper to safely format the birthday date
  const formatBirthday = (dateStr: string | null) => {
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
          <h3 className="text-lg font-medium">Customers & Contacts</h3>
          <p className="text-sm text-muted-foreground">
            Manage your customer database, contact details, and birthdays.
          </p>
        </div>
        
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <Button onClick={handleOpenAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
          
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingContact ? "Edit Customer" : "Add New Customer"}</SheetTitle>
              <SheetDescription>
                {editingContact 
                  ? "Update the details for this customer below." 
                  : "Enter the contact details for a new customer."}
              </SheetDescription>
            </SheetHeader>
            
            <form action={handleSubmit} className="flex flex-col h-full mt-6">
              {editingContact && <input type="hidden" name="id" value={editingContact.id} />}
              
              <div className="space-y-4 flex-1 pb-8">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="full_name" 
                    name="full_name" 
                    placeholder="e.g. Jane Doe" 
                    defaultValue={editingContact?.full_name || ""} 
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email"
                    placeholder="e.g. jane@example.com" 
                    defaultValue={editingContact?.email || ""} 
                    required
                  />
                </div>

                {/* Phone Number (Code + No) */}
                <div className="flex gap-4">
                  <div className="space-y-2 w-1/3">
                    <Label htmlFor="country_code">Code</Label>
                    <Input 
                      id="country_code" 
                      name="country_code" 
                      placeholder="+44" 
                      defaultValue={editingContact?.country_code || ""} 
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="phone_no">Phone Number</Label>
                    <Input 
                      id="phone_no" 
                      name="phone_no" 
                      type="tel"
                      placeholder="e.g. 7123 456789" 
                      defaultValue={editingContact?.phone_no || ""} 
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
                    defaultValue={editingContact?.birthday ? new Date(editingContact.birthday).toISOString().split('T')[0] : ""} 
                  />
                </div>
              </div>
              
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
                  {editingContact ? "Update Customer" : "Save Customer"}
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
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Contact Details</th>
                <th className="px-4 py-3 font-medium">Birthday</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-foreground">{contact.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span>{contact.email}</span>
                      </div>
                      {(contact.country_code || contact.phone_no) && (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <Phone className="w-3 h-3" />
                          <span>{contact.country_code} {contact.phone_no}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {contact.birthday ? (
                        <>
                          <Cake className="w-4 h-4 text-pink-500" />
                          <span>{formatBirthday(contact.birthday)}</span>
                        </>
                      ) : (
                        <span className="italic text-xs">Not provided</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(contact)}
                        disabled={isPending}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(contact.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {initialContacts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    <User className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    No customers found. Add your first contact to get started.
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