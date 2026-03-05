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
  Plus, Edit2, Trash2, Layers, Info, Image as ImageIcon, Loader2,
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Beer
} from "lucide-react";
import { 
  saveEventTypeAction, 
  deleteEventTypeAction, 
  saveEventInfoAction, 
  deleteEventInfoAction 
} from "./actions";

// Define a curated list of Lucide icons available for selection
const ICON_OPTIONS = {
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
    Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer
};

// Types matching your joined Supabase schema
export type EventInfo = {
  id: number;
  icon: string | null;
  title: string;
  description: string | null;
};

export type EventTypeRecord = {
  id: number;
  type: string;
  sub_type: string;
  event_information: EventInfo[];
};

export default function EventTypesClient({ initialEventTypes = [] }: { initialEventTypes: EventTypeRecord[] }) {
  const [expandedType, setExpandedType] = useState<number | null>(null);

  // Transition for server actions
  const [isPending, startTransition] = useTransition();

  // State for Event Type Sheet
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);
  const [editingType, setEditingType] = useState<EventTypeRecord | null>(null);

  // State for Event Info Sheet
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState<EventInfo | null>(null);
  const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
  
  // State for the selected Lucide icon
  const [selectedIcon, setSelectedIcon] = useState<string>("");

  const toggleExpand = (id: number) => {
    setExpandedType(expandedType === id ? null : id);
  };

  // --- Handlers for Event Types ---
  const handleTypeSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveEventTypeAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        setIsTypeSheetOpen(false);
      }
    });
  };

  const handleDeleteType = (id: number) => {
    if (confirm("Are you sure you want to delete this event type? All linked information will also be deleted.")) {
      startTransition(async () => {
        const result = await deleteEventTypeAction(id);
        if (result?.error) alert(result.error);
      });
    }
  };

  // --- Handlers for Event Info ---
  const handleInfoSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveEventInfoAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        setIsInfoSheetOpen(false);
      }
    });
  };

  const handleDeleteInfo = (id: number) => {
    if (confirm("Are you sure you want to delete this information item?")) {
      startTransition(async () => {
        const result = await deleteEventInfoAction(id);
        if (result?.error) alert(result.error);
      });
    }
  };

  // Helper to render the Lucide icon safely
  const renderIcon = (iconStr: string | null) => {
    // If no icon is provided or the string is not in our mapping, fallback to generic icon
    if (!iconStr || !(iconStr in ICON_OPTIONS)) {
      return <ImageIcon className="w-5 h-5 text-muted-foreground" />;
    }
    
    // Render the mapped Lucide component dynamically
    const SelectedIcon = ICON_OPTIONS[iconStr as keyof typeof ICON_OPTIONS];
    return <SelectedIcon className="w-5 h-5" />;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-medium">Event Types & Information</h3>
          <p className="text-sm text-muted-foreground">
            Manage your high-level event categories and their specific linked information details.
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={() => { setEditingType(null); setIsTypeSheetOpen(true); }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Event Type
        </Button>
      </div>

      <div className="mt-6 space-y-6">
        {initialEventTypes.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium">No Event Types Found</h3>
            <p className="text-sm text-muted-foreground">Get started by creating your first event type.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {initialEventTypes.map((eventType) => (
              <div key={eventType.id} className="border rounded-lg bg-card overflow-hidden shadow-sm">
                {/* Event Type Header */}
                <div className="p-5 flex items-center justify-between bg-muted/10 border-b">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-primary" />
                      <h4 className="text-lg font-semibold">{eventType.type}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sub-type: <span className="font-medium text-foreground">{eventType.sub_type}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleExpand(eventType.id)}>
                      {expandedType === eventType.id ? "Hide Info" : `View Info (${eventType.event_information?.length || 0})`}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => { setEditingType(eventType); setIsTypeSheetOpen(true); }}
                      disabled={isPending}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteType(eventType.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Linked Event Information */}
                {(expandedType === eventType.id || initialEventTypes.length === 1) && (
                  <div className="p-5 bg-muted/5">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-sm font-semibold flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Linked Information
                      </h5>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs"
                        onClick={() => { 
                          setEditingInfo(null); 
                          setActiveTypeId(eventType.id); 
                          setSelectedIcon(""); // Reset icon selection
                          setIsInfoSheetOpen(true); 
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Info
                      </Button>
                    </div>

                    {(!eventType.event_information || eventType.event_information.length === 0) ? (
                      <p className="text-sm text-muted-foreground italic pl-6">No information linked to this type yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {eventType.event_information.map((info) => (
                          <div key={info.id} className="flex gap-4 p-4 border rounded-md bg-background relative group">
                            <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-secondary text-primary rounded-full border">
                              {renderIcon(info.icon)}
                            </div>
                            <div className="flex-1">
                              <h6 className="font-medium text-sm">{info.title}</h6>
                              {info.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {info.description}
                                </p>
                              )}
                            </div>
                            {/* Hover Actions for Info */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1 shadow-sm border">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => { 
                                  setEditingInfo(info); 
                                  setActiveTypeId(eventType.id); 
                                  setSelectedIcon(info.icon || ""); // Set icon selection to current
                                  setIsInfoSheetOpen(true); 
                                }}
                                disabled={isPending}
                              >
                                <Edit2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => handleDeleteInfo(info.id)}
                                disabled={isPending}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- SHEET: EVENT TYPE --- */}
      <Sheet open={isTypeSheetOpen} onOpenChange={setIsTypeSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingType ? "Edit Event Type" : "Add Event Type"}</SheetTitle>
            <SheetDescription>
              Define the high-level category of an event.
            </SheetDescription>
          </SheetHeader>
          
          <form action={handleTypeSubmit} className="flex flex-col h-full mt-6">
            {editingType && <input type="hidden" name="id" value={editingType.id} />}
            
            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Label htmlFor="type">Primary Type <span className="text-destructive">*</span></Label>
                <Input 
                  id="type" 
                  name="type" 
                  placeholder="e.g. Masterclass" 
                  defaultValue={editingType?.type || ""} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub_type">Sub-Type <span className="text-destructive">*</span></Label>
                <Input 
                  id="sub_type" 
                  name="sub_type" 
                  placeholder="e.g. Cocktail Masterclass" 
                  defaultValue={editingType?.sub_type || ""} 
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-8 pb-4">
              <Button type="button" variant="outline" onClick={() => setIsTypeSheetOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingType ? "Update Type" : "Save Type"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* --- SHEET: EVENT INFORMATION --- */}
      <Sheet open={isInfoSheetOpen} onOpenChange={setIsInfoSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingInfo ? "Edit Linked Info" : "Add Linked Info"}</SheetTitle>
            <SheetDescription>
              Provide specific details or features for this event type.
            </SheetDescription>
          </SheetHeader>
          
          <form action={handleInfoSubmit} className="flex flex-col h-full mt-6">
            {editingInfo && <input type="hidden" name="id" value={editingInfo.id} />}
            {/* Always pass the active parent Type ID so we know where to link it */}
            <input type="hidden" name="event_types_id" value={activeTypeId || ""} />
            {/* Hidden input to hold the selected icon string for FormData */}
            <input type="hidden" name="icon" value={selectedIcon} />
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-4">
              <div className="space-y-2">
                <Label htmlFor="title">Information Title <span className="text-destructive">*</span></Label>
                <Input 
                  id="title" 
                  name="title" 
                  placeholder="e.g. Duration" 
                  defaultValue={editingInfo?.title || ""} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input 
                  id="description" 
                  name="description" 
                  placeholder="e.g. 2 hours minimum" 
                  defaultValue={editingInfo?.description || ""} 
                />
              </div>
              <div className="space-y-2 pt-2">
                <Label>Select an Icon</Label>
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {Object.entries(ICON_OPTIONS).map(([name, IconComponent]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedIcon(name)}
                      className={`flex flex-col items-center justify-center p-3 rounded-md border transition-colors ${
                        selectedIcon === name 
                          ? 'bg-primary/10 border-primary text-primary' 
                          : 'hover:bg-muted bg-background text-muted-foreground'
                      }`}
                      title={name}
                    >
                      <IconComponent className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 mt-auto border-t">
              <Button type="button" variant="outline" onClick={() => setIsInfoSheetOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingInfo ? "Update Info" : "Save Info"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

    </div>
  );
}