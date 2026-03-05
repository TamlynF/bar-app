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
import { Plus, Edit2, Trash2, Loader2, Calendar } from "lucide-react";
import { saveEventAction, deleteEventAction } from "./actions";

// Adapted to match your Supabase public.events schema
export type EventRecord = {
  id: number;
  created_at?: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  description: string | null;
  seating_required: boolean | null;
  payment_amount: number | null;
  host_employee_id: number | null;
  event_types_id: number;
};

export default function EventsClient({ initialEvents = [] }: { initialEvents: EventRecord[] }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  
  const [isPending, startTransition] = useTransition();

  const handleOpenEdit = (event: EventRecord) => {
    setEditingEvent(event);
    setIsSheetOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setIsSheetOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this event?")) {
      startTransition(async () => {
        const result = await deleteEventAction(id);
        if (result?.error) {
          alert(result.error);
        }
      });
    }
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveEventAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        setIsSheetOpen(false); // Close sheet on success
      }
    });
  };

  // Helper to format currency
  const formatCurrency = (amount: number | null) => {
    if (!amount) return "£0.00";
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-medium">Event Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage upcoming events, scheduling, and seating requirements.
          </p>
        </div>
        
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <Button onClick={handleOpenAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
          
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingEvent ? "Edit Event" : "Create New Event"}</SheetTitle>
              <SheetDescription>
                {editingEvent 
                  ? "Update the details for this event below." 
                  : "Fill in the details to schedule a new event."}
              </SheetDescription>
            </SheetHeader>
            
            <form action={handleSubmit} className="flex flex-col h-full mt-6">
              {editingEvent && <input type="hidden" name="id" value={editingEvent.id} />}
              
              <div className="space-y-4 flex-1 pb-8">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title</Label>
                  <Input 
                    id="title" 
                    name="title" 
                    placeholder="e.g. Trivia Night" 
                    defaultValue={editingEvent?.title || ""} 
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input 
                    id="description" 
                    name="description" 
                    placeholder="Short description..." 
                    defaultValue={editingEvent?.description || ""} 
                  />
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
                  <Input 
                    id="date" 
                    name="date" 
                    type="date"
                    required
                    defaultValue={editingEvent?.date ? new Date(editingEvent.date).toISOString().split('T')[0] : ""} 
                  />
                </div>

                {/* Times */}
                <div className="flex gap-4">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input 
                      id="start_time" 
                      name="start_time" 
                      type="time"
                      defaultValue={editingEvent?.start_time?.substring(0, 5) || ""} 
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="end_time">End Time</Label>
                    <Input 
                      id="end_time" 
                      name="end_time" 
                      type="time"
                      defaultValue={editingEvent?.end_time?.substring(0, 5) || ""} 
                    />
                  </div>
                </div>

                {/* Payment Amount */}
                <div className="space-y-2">
                  <Label htmlFor="payment_amount">Payment Amount (£)</Label>
                  <Input 
                    id="payment_amount" 
                    name="payment_amount" 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    defaultValue={editingEvent?.payment_amount || ""} 
                  />
                </div>

                {/* Relations (Event Type & Employee) */}
                <div className="flex gap-4">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="event_types_id">Event Type ID <span className="text-destructive">*</span></Label>
                    <Input 
                      id="event_types_id" 
                      name="event_types_id" 
                      type="number"
                      required
                      defaultValue={editingEvent?.event_types_id || ""} 
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="host_employee_id">Host Employee ID</Label>
                    <Input 
                      id="host_employee_id" 
                      name="host_employee_id" 
                      type="number"
                      defaultValue={editingEvent?.host_employee_id || ""} 
                    />
                  </div>
                </div>

                {/* Seating Required Checkbox */}
                <div className="flex items-center gap-2 pt-2">
                  <Input 
                    type="checkbox" 
                    id="seating_required" 
                    name="seating_required"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    defaultChecked={editingEvent ? (editingEvent.seating_required ?? true) : true}
                  />
                  <Label htmlFor="seating_required" className="cursor-pointer">
                    Requires Seating Reservations
                  </Label>
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
                  {editingEvent ? "Update Event" : "Save Event"}
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
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Date & Time</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Seating</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialEvents.map((event) => (
                <tr key={event.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {event.title || "Untitled Event"}
                    {event.description && <p className="text-xs text-muted-foreground font-normal line-clamp-1">{event.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>{new Date(event.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {event.start_time?.substring(0, 5) || "TBD"} {event.end_time ? `- ${event.end_time.substring(0, 5)}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {formatCurrency(event.payment_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${event.seating_required ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-secondary text-secondary-foreground'}`}>
                      {event.seating_required ? 'Required' : 'None'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(event)}
                        disabled={isPending}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(event.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {initialEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No events scheduled yet.
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