"use client";

import { useState, useTransition, useMemo } from "react";
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
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Beer,
  ChevronDown, ChevronRight
} from "lucide-react";
import { 
  saveEventTypeAction, 
  deleteEventTypeAction, 
  saveEventInfoAction, 
  deleteEventInfoAction 
} from "@/app/(private)/dashboard/settings/event-types/actions";
import { cn } from "@/lib/utils";

const ICON_OPTIONS = {
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer
};

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

/**
 * Helper to capitalize the first letter of a string (Title Case)
 */
const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export default function EventTypesClient({ initialEventTypes = [] }: { initialEventTypes: EventTypeRecord[] }) {
  const [expandedSubtype, setExpandedSubtype] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [isPending, startTransition] = useTransition();

  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);
  const [editingType, setEditingType] = useState<EventTypeRecord | null>(null);

  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState<EventInfo | null>(null);
  const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
  
  const [selectedIcon, setSelectedIcon] = useState<string>("");

  /**
   * Group event types by their primary 'type' field
   */
  const groupedEventTypes = useMemo(() => {
    const groups: Record<string, EventTypeRecord[]> = {};
    
    initialEventTypes.forEach((item) => {
      const key = item.type.toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [initialEventTypes]);

  const toggleGroup = (type: string) => {
    const next = new Set(expandedGroups);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setExpandedGroups(next);
  };

  const toggleSubtypeExpand = (id: number) => {
    setExpandedSubtype(expandedSubtype === id ? null : id);
  };

  // --- Handlers ---
  const handleTypeSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveEventTypeAction(formData);
      if (result?.error) {
        console.error(result.error);
      } else {
        setIsTypeSheetOpen(false);
      }
    });
  };

  const handleDeleteType = (id: number) => {
    if (window.confirm("Are you sure? This will delete all linked information.")) {
      startTransition(async () => {
        const result = await deleteEventTypeAction(id);
        if (result?.error) console.error(result.error);
      });
    }
  };

  const handleInfoSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveEventInfoAction(formData);
      if (result?.error) {
        console.error(result.error);
      } else {
        setIsInfoSheetOpen(false);
      }
    });
  };

  const handleDeleteInfo = (id: number) => {
    if (window.confirm("Delete this information item?")) {
      startTransition(async () => {
        const result = await deleteEventInfoAction(id);
        if (result?.error) console.error(result.error);
      });
    }
  };

  const renderIcon = (iconStr: string | null) => {
    if (!iconStr || !(iconStr in ICON_OPTIONS)) {
      return <ImageIcon className="w-5 h-5 text-muted-foreground" />;
    }
    const SelectedIcon = ICON_OPTIONS[iconStr as keyof typeof ICON_OPTIONS];
    return <SelectedIcon className="w-5 h-5" />;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-medium">Event Types & Information</h3>
          <p className="text-sm text-muted-foreground">
            Manage your event categories and specific requirements.
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

      <div className="mt-6 space-y-4">
        {groupedEventTypes.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-muted/10 border-dashed">
            <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">No Event Types Configured</h3>
          </div>
        ) : (
          groupedEventTypes.map(([typeKey, items]) => {
            const isGroupExpanded = expandedGroups.has(typeKey) || groupedEventTypes.length === 1;
            
            return (
              <div key={typeKey} className="border rounded-2xl bg-card overflow-hidden shadow-sm transition-all duration-300">
                {/* Group Header */}
                <button 
                  type="button"
                  onClick={() => toggleGroup(typeKey)}
                  className="w-full p-4 flex items-center justify-between bg-muted/5 hover:bg-muted/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-black uppercase tracking-tight text-foreground">
                        {toTitleCase(typeKey)}
                      </h4>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {items.length} {items.length === 1 ? 'Sub-type' : 'Sub-types'}
                      </p>
                    </div>
                  </div>
                  {isGroupExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </button>

                {/* Sub-types List */}
                {isGroupExpanded && (
                  <div className="p-2 space-y-2 bg-background/50">
                    {items.map((item) => (
                      <div key={item.id} className="border rounded-xl bg-card overflow-hidden border-slate-200 dark:border-slate-800">
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="font-bold text-sm text-foreground">
                              {toTitleCase(item.sub_type)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                              onClick={() => toggleSubtypeExpand(item.id)}
                            >
                              {expandedSubtype === item.id ? "Close" : `Details (${item.event_information?.length || 0})`}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => { setEditingType(item); setIsTypeSheetOpen(true); }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteType(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Information Items */}
                        {expandedSubtype === item.id && (
                          <div className="px-3 pb-3 pt-1 border-t bg-muted/5 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center justify-between mb-3 mt-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Linked Info</span>
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="rounded-lg h-7 border-primary/20 text-primary"
                                onClick={() => { 
                                  setEditingInfo(null); 
                                  setActiveTypeId(item.id); 
                                  setSelectedIcon(""); 
                                  setIsInfoSheetOpen(true); 
                                }}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Add Detail
                              </Button>
                            </div>

                            {item.event_information.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic p-4 text-center">No additional details added.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {item.event_information.map((info) => (
                                  <div key={info.id} className="flex items-start gap-3 p-3 border rounded-lg bg-background relative group transition-colors hover:border-primary/30">
                                    <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-secondary text-primary rounded-lg">
                                      {renderIcon(info.icon)}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-12">
                                      <h6 className="font-bold text-[13px] text-foreground leading-none mb-1">{info.title}</h6>
                                      <p className="text-[11px] text-muted-foreground line-clamp-1">{info.description}</p>
                                    </div>
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button 
                                        className="p-1 text-muted-foreground hover:text-foreground"
                                        onClick={() => { 
                                          setEditingInfo(info); 
                                          setActiveTypeId(item.id); 
                                          setSelectedIcon(info.icon || ""); 
                                          setIsInfoSheetOpen(true); 
                                        }}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button 
                                        className="p-1 text-destructive hover:bg-destructive/10 rounded"
                                        onClick={() => handleDeleteInfo(info.id)}
                                      >
                                        <Trash2 className="w-3 h-3" />
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
            );
          })
        )}
      </div>

      {/* --- SHEETS --- */}
      <Sheet open={isTypeSheetOpen} onOpenChange={setIsTypeSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingType ? "Edit Event Type" : "Add Event Type"}</SheetTitle>
            <SheetDescription>Set the category and sub-category for your events.</SheetDescription>
          </SheetHeader>
          
          <form action={handleTypeSubmit} className="flex flex-col h-full mt-6">
            {editingType && <input type="hidden" name="id" value={editingType.id} />}
            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Label htmlFor="type">Category (e.g. Masterclass)</Label>
                <Input id="type" name="type" placeholder="Primary category" defaultValue={editingType?.type || ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub_type">Name (e.g. Cocktail Experience)</Label>
                <Input id="sub_type" name="sub_type" placeholder="Specific sub-type" defaultValue={editingType?.sub_type || ""} required />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pb-4">
              <Button type="button" variant="outline" onClick={() => setIsTypeSheetOpen(false)} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Type
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={isInfoSheetOpen} onOpenChange={setIsInfoSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingInfo ? "Edit Detail" : "Add Detail"}</SheetTitle>
            <SheetDescription>Provide specific parameters for this event type.</SheetDescription>
          </SheetHeader>
          
          <form action={handleInfoSubmit} className="flex flex-col h-full mt-6">
            {editingInfo && <input type="hidden" name="id" value={editingInfo.id} />}
            <input type="hidden" name="event_types_id" value={activeTypeId || ""} />
            <input type="hidden" name="icon" value={selectedIcon} />
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-4">
              <div className="space-y-2">
                <Label htmlFor="title">Label (e.g. Duration)</Label>
                <Input id="title" name="title" placeholder="e.g. Price Per Person" defaultValue={editingInfo?.title || ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Value/Description</Label>
                <Input id="description" name="description" placeholder="e.g. £35.00" defaultValue={editingInfo?.description || ""} />
              </div>
              <div className="space-y-2 pt-2">
                <Label>Identify with Icon</Label>
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {Object.entries(ICON_OPTIONS).map(([name, IconComponent]) => (
                    <button
                      key={name}
                      title={name}
                      type="button"
                      onClick={() => setSelectedIcon(name)}
                      className={cn(
                        "flex items-center justify-center p-3 rounded-xl border transition-all",
                        selectedIcon === name 
                          ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105' 
                          : 'hover:bg-muted bg-background text-muted-foreground'
                      )}
                    >
                      <IconComponent className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 mt-auto border-t">
              <Button type="button" variant="outline" onClick={() => setIsInfoSheetOpen(false)} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Info
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}