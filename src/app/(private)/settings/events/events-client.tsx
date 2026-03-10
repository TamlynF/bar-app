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
  SheetFooter,
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
  Calendar, 
  Clock, 
  BadgePoundSterling, 
  Users, 
  MoreVertical,
  AlertCircle,
  ChevronRight,
  LayoutDashboard
} from "lucide-react";
// Using relative import as standard for siblings to resolve resolution issues
import { saveEventAction, deleteEventAction } from "./actions";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  const [isPending, startTransition] = useTransition();

  const handleOpenEdit = (event: EventRecord) => {
    setEditingEvent(event);
    setIsSheetOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setIsSheetOpen(true);
  };

  const executeDelete = (id: number) => {
    startTransition(async () => {
      const result = await deleteEventAction(id);
      if (result?.error) {
        console.error(result.error);
      }
      setDeleteConfirmId(null);
    });
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveEventAction(formData);
      if (result?.error) {
        console.error(result.error);
      } else {
        setIsSheetOpen(false);
      }
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined || amount === 0) return "Free";
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  return (
    <div className="p-6 sm:p-6">
      {/* List Container - Matches Tables style by removing the extra header and starting with the border-box */}
      <div className="mt-2 border rounded-2xl overflow-hidden bg-card shadow-sm transition-all border-[#E6DFC8]">
        
        {/* Table/List Toolbar - Identical to Tables setting UI */}
        <div className="p-3 border-b border-[#E6DFC8] bg-muted/5 flex items-center justify-between">
           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Scheduled Events</span>
           <Button onClick={handleOpenAdd} size="sm" className="font-bold uppercase tracking-wider text-[10px] h-8 px-3 rounded-xl">
             <Plus className="w-3.5 h-3.5 mr-1.5" />
             Add
           </Button>
        </div>

        {initialEvents.length === 0 ? (
          <div className="py-16 text-center">
            <LayoutDashboard className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground italic">No events scheduled yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-sm text-left border-collapse min-w-[320px]">
              <thead className="bg-muted/30 border-b border-[#E6DFC8]">
                <tr>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground">Event Details</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground">Schedule</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground">Pricing</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground">Seating</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] text-muted-foreground text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {initialEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground">{event.title || "Untitled Event"}</div>
                      {event.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 italic font-medium">{event.description}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-primary/60" />
                        <span>{format(new Date(event.date), "do MMM yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{event.start_time?.substring(0, 5) || "TBD"} {event.end_time ? `- ${event.end_time.substring(0, 5)}` : ""}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-primary">{formatCurrency(event.payment_amount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                        event.seating_required 
                          ? "bg-blue-50 text-blue-700 border-blue-200" 
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      )}>
                        {event.seating_required ? 'Required' : 'Optional'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(event)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmId(event.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card-style View for optimized vertical scanning */}
            <div className="md:hidden divide-y divide-border/40">
              {initialEvents.map((event) => (
                <div key={event.id} className="p-4 hover:bg-muted/10 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-4 text-left">
                      <h4 className="font-bold text-sm text-foreground truncate">{event.title || "Untitled Event"}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase mt-1">
                        <Calendar className="w-3 h-3 text-primary" />
                        {format(new Date(event.date), "dd MMM yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleOpenEdit(event)}>
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => setDeleteConfirmId(event.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-foreground">{event.start_time?.substring(0, 5) || "TBD"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BadgePoundSterling className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-foreground">{formatCurrency(event.payment_amount)}</span>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                      event.seating_required 
                        ? "bg-blue-50 text-blue-700 border-blue-200" 
                        : "bg-slate-50 text-slate-400 border-slate-200"
                    )}>
                      {event.seating_required ? 'Req.' : 'Opt.'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- ADD/EDIT EVENT SHEET --- */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md h-full flex flex-col p-0 gap-0 border-l border-border/50 overflow-hidden">
          <SheetHeader className="px-6 pt-8 pb-6 text-left border-b border-border/40 bg-card">
            <SheetTitle className="text-2xl font-black uppercase tracking-tight">
              {editingEvent ? "Edit Event" : "Create New Event"}
            </SheetTitle>
            <SheetDescription className="text-sm font-medium">
              Fill in the details to schedule and configure your event.
            </SheetDescription>
          </SheetHeader>
          
          <form action={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-background/30">
            {editingEvent && <input type="hidden" name="id" value={editingEvent.id} />}
            
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
              <div className="space-y-4">
                <div className="space-y-2 text-left">
                  <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Event Title</Label>
                  <Input 
                    id="title" 
                    name="title" 
                    placeholder="e.g. Thursday Night Trivia" 
                    defaultValue={editingEvent?.title || ""} 
                    className="h-12 rounded-xl text-base shadow-sm border-border bg-white"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Internal Description</Label>
                  <Input 
                    id="description" 
                    name="description" 
                    placeholder="Brief overview..." 
                    defaultValue={editingEvent?.description || ""} 
                    className="h-12 rounded-xl shadow-sm border-border bg-white"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 border-b border-primary/10 pb-2 text-left">Schedule & Timing</h5>
                <div className="space-y-2 text-left">
                  <Label htmlFor="date" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Event Date <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input 
                      id="date" 
                      name="date" 
                      type="date"
                      required
                      defaultValue={editingEvent?.date ? new Date(editingEvent.date).toISOString().split('T')[0] : ""} 
                      className="h-12 rounded-xl pl-10 shadow-sm border-border bg-white appearance-none"
                    />
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="start_time" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Start</Label>
                    <Input id="start_time" name="start_time" type="time" defaultValue={editingEvent?.start_time?.substring(0, 5) || ""} className="h-12 rounded-xl shadow-sm border-border bg-white" />
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="end_time" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">End</Label>
                    <Input id="end_time" name="end_time" type="time" defaultValue={editingEvent?.end_time?.substring(0, 5) || ""} className="h-12 rounded-xl shadow-sm border-border bg-white" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 border-b border-primary/10 pb-2 text-left">Logistics & Fees</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="payment_amount" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Entry Fee (£)</Label>
                    <div className="relative">
                      <Input id="payment_amount" name="payment_amount" type="number" step="0.01" min="0" placeholder="0.00" defaultValue={editingEvent?.payment_amount || ""} className="h-12 rounded-xl pl-10 shadow-sm border-border bg-white font-mono" />
                      <BadgePoundSterling className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="event_types_id" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Type ID <span className="text-destructive">*</span></Label>
                    <Input id="event_types_id" name="event_types_id" type="number" required defaultValue={editingEvent?.event_types_id || ""} className="h-12 rounded-xl shadow-sm border-border bg-white" />
                  </div>
                </div>
                <div className="space-y-2 text-left">
                  <Label htmlFor="host_employee_id" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Host Employee ID</Label>
                  <Input id="host_employee_id" name="host_employee_id" type="number" defaultValue={editingEvent?.host_employee_id || ""} className="h-12 rounded-xl shadow-sm border-border bg-white" />
                </div>
              </div>

              <div className="bg-muted/30 rounded-2xl p-5 border border-border/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5 text-left">
                    <Label htmlFor="seating_required" className="text-sm font-black uppercase tracking-tight text-foreground cursor-pointer">Require Seating</Label>
                    <p className="text-[11px] text-muted-foreground font-medium leading-tight">Enforce table assignments for this event.</p>
                  </div>
                  <Input 
                    type="checkbox" id="seating_required" name="seating_required"
                    className="h-6 w-6 rounded-lg border-primary/20 accent-primary"
                    defaultChecked={editingEvent ? (editingEvent.seating_required ?? true) : true}
                  />
                </div>
              </div>
            </div>
            
            <SheetFooter className="px-6 py-6 border-t border-border/40 bg-card/80 backdrop-blur pb-10 sm:pb-6">
              <div className="flex gap-3 w-full">
                <Button type="button" variant="outline" onClick={() => setIsSheetOpen(false)} disabled={isPending} className="flex-1 h-12 rounded-xl font-bold uppercase tracking-wider text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg">
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingEvent ? "Update" : "Save"}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* DELETE CONFIRMATION OVERLAY */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-9999 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-border animate-in zoom-in-95">
            <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center text-destructive mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">Delete Event?</h4>
            <p className="text-sm text-muted-foreground font-medium mb-8 leading-relaxed text-left">
              Are you sure you want to permanently remove this event? This action cannot be reversed.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="destructive" className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs" onClick={() => executeDelete(deleteConfirmId)} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Permanently"}
              </Button>
              <Button variant="ghost" className="w-full h-12 rounded-xl font-bold uppercase tracking-wider text-xs" onClick={() => setDeleteConfirmId(null)} disabled={isPending}>
                Go Back
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global Processing Indicator */}
      {isPending && !deleteConfirmId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#26300D] text-[#FDCC4B] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-primary-foreground/20 animate-in slide-in-from-bottom-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Syncing</span>
        </div>
      )}
    </div>
  );
}