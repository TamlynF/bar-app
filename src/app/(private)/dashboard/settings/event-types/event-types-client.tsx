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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Edit2, Trash2, Layers, Info, Image as ImageIcon, Loader2,
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Beer,
  ChevronDown, ChevronRight, Banknote, Trophy, Wine,
  MoreVertical, RotateCcw
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
  Beer, Banknote, Trophy, Wine
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

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export default function EventTypesClient({ initialEventTypes = [] }: { initialEventTypes: EventTypeRecord[] }) {
  const [expandedSubtype, setExpandedSubtype] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);
  const [editingType, setEditingType] = useState<Partial<EventTypeRecord> | null>(null);
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState<EventInfo | null>(null);
  const [sheetMode, setSheetMode] = useState<'category' | 'subtype'>('subtype');
  const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>("");
  const [typeSheetError, setTypeSheetError] = useState<string | null>(null);
  
  // Track if user is adding a completely new category name manually
  const [isCustomType, setIsCustomType] = useState(false);

  const { groupedEventTypes, uniqueTypes } = useMemo(() => {
    const groups: Record<string, EventTypeRecord[]> = {};
    const typeSet = new Set<string>();

    initialEventTypes.forEach((item) => {
      const key = item.type.toLowerCase();
      typeSet.add(toTitleCase(item.type));
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    Object.values(groups).forEach(items => {
      items.sort((a, b) => a.sub_type.localeCompare(b.sub_type));
    });

    return {
      groupedEventTypes: Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])),
      uniqueTypes: Array.from(typeSet).sort()
    };
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

  const handleTypeSubmit = (formData: FormData) => {
    console.log(Object.fromEntries(formData.entries()));
    setTypeSheetError(null);
    const rawType = formData.get("type")?.toString() || "";

    const rawSubType = sheetMode === 'category'
      ? (editingType?.sub_type || "General")
      : (formData.get("sub_type")?.toString() || "");

    const formattedType = toTitleCase(rawType);
    const formattedSubType = toTitleCase(rawSubType);

    const isDuplicate = initialEventTypes.some(item =>
      item.type.toLowerCase() === formattedType.toLowerCase() &&
      item.sub_type.toLowerCase() === formattedSubType.toLowerCase() &&
      item.id !== editingType?.id
    );

    if (isDuplicate && sheetMode === 'subtype') {
      setTypeSheetError(`The sub-type "${formattedSubType}" already exists for event type "${formattedType}".`);
      return;
    }

    formData.set("type", formattedType.toLowerCase());
    formData.set("sub_type", formattedSubType.toLowerCase());

    startTransition(async () => {
      const result = await saveEventTypeAction(formData);
      if (result?.error) {
        setTypeSheetError(result.error);
        console.error(result.error);
      } else {
        setIsTypeSheetOpen(false);
        setIsCustomType(false);
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
    console.log("Submitting Event Info Form with data:", Object.fromEntries(formData.entries()));

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
          onClick={() => {
            setEditingType(null);
            setSheetMode('category');
            setTypeSheetError(null);
            setIsCustomType(false);
            setIsTypeSheetOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
           Type
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
                <div className="w-full flex items-center justify-between bg-muted/5 transition-colors text-left">
                  <button
                    type="button"
                    onClick={() => toggleGroup(typeKey)}
                    className="flex-1 p-4 flex items-center gap-3 hover:bg-muted/5 transition-colors"
                  >
                    <div className="hidden sm:flex w-10 h-10 rounded-xl bg-primary/10 items-center justify-center text-primary shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <h4 className="text-base font-black tracking-tight text-foreground truncate">
                        {toTitleCase(typeKey)}
                      </h4>
                      <span className="inline-flex items-center bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0">
                        {items.length} {items.length === 1 ? 'Sub-type' : 'Sub-types'}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center pr-2 sm:pr-4 gap-1 sm:gap-2">
                    {/* DESKTOP ACTIONS: Visible Buttons */}
                    <div className="hidden sm:flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="xs"
                        className="h-7 px-2 rounded-lg border-primary/20 text-primary font-bold uppercase tracking-wider text-[9px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingType({ type: toTitleCase(typeKey) });
                          setSheetMode('subtype');
                          setTypeSheetError(null);
                          setIsCustomType(false);
                          setIsTypeSheetOpen(true);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Sub-type
                      </Button>

                      {items.length > 0 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingType({
                                ...items[0],
                                type: toTitleCase(items[0].type),
                                sub_type: toTitleCase(items[0].sub_type)
                              });
                              setSheetMode('category');
                              setTypeSheetError(null);
                              setIsCustomType(false);
                              setIsTypeSheetOpen(true);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteType(items[0].id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>

                    {/* MOBILE ACTIONS: 3-Dot Menu */}
                    <div className="sm:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ backgroundColor: "#E2EDBF" }} className="z-9999">
                          <DropdownMenuItem onClick={() => {
                            setEditingType({ type: toTitleCase(typeKey) });
                            setSheetMode('subtype');
                            setTypeSheetError(null);
                            setIsCustomType(false);
                            setIsTypeSheetOpen(true);
                          }}>
                            <Plus className="w-4 h-4 mr-2" /> Sub-type
                          </DropdownMenuItem>

                          {items.length > 0 && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setEditingType({
                                  ...items[0],
                                  type: toTitleCase(items[0].type),
                                  sub_type: toTitleCase(items[0].sub_type)
                                });
                                setSheetMode('category');
                                setTypeSheetError(null);
                                setIsCustomType(false);
                                setIsTypeSheetOpen(true);
                              }}>
                                <Edit2 className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteType(items[0].id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <button type="button" onClick={() => toggleGroup(typeKey)} className="p-1">
                      {isGroupExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Sub-types List */}
                {isGroupExpanded && (
                  <div className="p-2 space-y-2 bg-background/50 border-t border-slate-100 dark:border-slate-800">
                    {items.map((item) => (
                      <div key={item.id} className="border rounded-xl bg-card overflow-hidden border-slate-200 dark:border-slate-800">
                        <div className="p-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleSubtypeExpand(item.id)}
                            className="flex-1 flex items-center gap-3 p-2 hover:bg-muted/5 transition-colors text-left"
                          >
                            <div className="shrink-0">
                              {expandedSubtype === item.id ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            <span className="font-bold text-sm text-foreground">
                              {toTitleCase(item.sub_type)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium ml-1">({item.event_information?.length || 0} items)</span>
                          </button>

                          <div className="flex items-center gap-1 pr-1">
                            <div className="hidden sm:flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                onClick={() => {
                                  setEditingType({
                                    ...item,
                                    type: toTitleCase(item.type),
                                    sub_type: toTitleCase(item.sub_type)
                                  });
                                  setSheetMode('subtype');
                                  setTypeSheetError(null);
                                  setIsCustomType(false);
                                  setIsTypeSheetOpen(true);
                                }}
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
                            {/* Mobile Actions Dropdown */}
                            <div className="sm:hidden">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" style={{ backgroundColor: "#E2EDBF" }}>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingType({
                                      ...item,
                                      type: toTitleCase(item.type),
                                      sub_type: toTitleCase(item.sub_type)
                                    });
                                    setSheetMode('subtype');
                                    setTypeSheetError(null);
                                    setIsCustomType(false);
                                    setIsTypeSheetOpen(true);
                                  }}>
                                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteType(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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
                                <Plus className="w-3 h-3 mr-1" /> Info
                              </Button>
                            </div>

                            {item.event_information.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic p-4 text-center">No additional details added.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {item.event_information.map((info) => (
                                  <div key={info.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background relative group transition-colors hover:border-primary/30">
                                    <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-secondary text-primary rounded-lg">
                                      {renderIcon(info.icon)}
                                    </div>

                                    <div className="flex-1 min-w-0 pr-2">
                                      <h6 className="font-bold text-[13px] text-foreground leading-none mb-1">{info.title}</h6>
                                      <p className="text-[11px] text-muted-foreground line-clamp-1">{info.description}</p>
                                    </div>

                                    {/* Mobile Actions Dropdown */}
                                    <div className="sm:hidden shrink-0">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                            <MoreVertical className="w-3.5 h-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" style={{ backgroundColor: "#E2EDBF" }}>
                                          <DropdownMenuItem onClick={() => {
                                            setEditingInfo(info);
                                            setActiveTypeId(item.id);
                                            setSelectedIcon(info.icon || "");
                                            setIsInfoSheetOpen(true);
                                          }}>
                                            <Edit2 className="w-4 h-4 mr-2" /> Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => handleDeleteInfo(info.id)}
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>

                                    {/* Desktop Actions (Hover) */}
                                    <div className="absolute top-2 right-2 hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        className="p-1 h-auto text-muted-foreground hover:text-foreground"
                                        onClick={() => {
                                          setEditingInfo(info);
                                          setActiveTypeId(item.id);
                                          setSelectedIcon(info.icon || "");
                                          setIsInfoSheetOpen(true);
                                        }}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        className="p-1 h-auto text-destructive hover:bg-destructive/10 rounded"
                                        onClick={() => handleDeleteInfo(info.id)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
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

      {/* 1. Add/Edit Event Type Sheet */}
      <Sheet open={isTypeSheetOpen} onOpenChange={(open) => {
        setIsTypeSheetOpen(open);
        if (!open) setIsCustomType(false);
      }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === 'category'
                ? (editingType?.id ? "Edit Event Type" : "Add Event Type")
                : (editingType?.id ? "Edit Sub-type" : "Add Sub-type")
              }
            </SheetTitle>
            <SheetDescription>
              {sheetMode === 'category'
                ? "Define the primary classification for your events."
                : "Define the specific variant within this type."
              }
            </SheetDescription>
          </SheetHeader>

          <form action={handleTypeSubmit} className="flex flex-col h-full mt-6">
            {editingType?.id && <input type="hidden" name="id" value={editingType.id} />}

            <div className="space-y-5 flex-1">
              {/* Event Type Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="type">Event Type <span className="text-destructive">*</span></Label>
                
                {!isCustomType ? (
                  <div className="relative group">
                    <select
                      id="type"
                      title="type"
                      name="type"
                      required
                      defaultValue={editingType?.type ? toTitleCase(editingType.type) : ""}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                      onChange={(e) => {
                        if (e.target.value === "custom") {
                          setIsCustomType(true);
                        }
                      }}
                    >
                      <option value="" disabled>Select an event type...</option>
                      {uniqueTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="custom" className="font-bold text-primary">+ Create New Event Type...</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground group-hover:text-foreground transition-colors">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex gap-2">
                      <Input
                        id="type"
                        name="type"
                        placeholder="Enter new event type..."
                        required
                        autoFocus
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        title="Back to list"
                        onClick={() => setIsCustomType(false)}
                        className="shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic px-1">
                      Typing a new name will create a fresh event type in your database.
                    </p>
                  </div>
                )}
                
                {!isCustomType && (
                  <p className="text-[10px] text-muted-foreground italic px-1">
                    Choose an existing event type or create a new one.
                  </p>
                )}
              </div>

              {sheetMode === 'subtype' && (
                <div className="space-y-2">
                  <Label htmlFor="sub_type">Sub-type <span className="text-destructive">*</span></Label>
                  <Input
                    id="sub_type"
                    name="sub_type"
                    placeholder="e.g. Speed Quiz"
                    defaultValue={editingType?.sub_type ? toTitleCase(editingType.sub_type) : ""}
                    required
                  />
                </div>
              )}

              {typeSheetError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-destructive leading-tight">{typeSheetError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8 pb-4">
              <Button type="button" variant="outline" onClick={() => setIsTypeSheetOpen(false)} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingType?.id ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* 2. Add/Edit Event Information Detail Sheet */}
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
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" placeholder="e.g. Every Thursday" defaultValue={editingInfo?.title || ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="e.g. 8:00PM start" defaultValue={editingInfo?.description || ""} />
              </div>
              <div className="space-y-2 pt-2">
                <Label>Icon</Label>
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
