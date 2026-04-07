"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
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
  MoreVertical, RotateCcw, Speaker, User
} from "lucide-react";
import {
  saveEventTypeAction,
  renameEventTypeGroupAction,
  deleteEventTypeAction,
  saveEventInfoAction,
  deleteEventInfoAction,
  deleteEventTypeGroupAction
} from "@/app/(private)/event-setups/event-types/actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EVENT_TYPE_COLORS, badgeClassFromColor } from "@/lib/event-type-colors";

const ICON_OPTIONS = {
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer, Banknote, Trophy, Wine, Speaker, User
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
  badge_color?: string | null;
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
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [expandedSubtype, setExpandedSubtype] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);
  const [editingType, setEditingType] = useState<Partial<EventTypeRecord> | null>(null);
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState<EventInfo | null>(null);
  const [sheetMode, setSheetMode] = useState<'type' | 'subtype'>('subtype');
  const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [typeSheetError, setTypeSheetError] = useState<string | null>(null);
  const [isCustomType, setIsCustomType] = useState(false);
  const [selectedTypeValue, setSelectedTypeValue] = useState<string>("");
  const [typeInput, setTypeInput] = useState("");
  const [subTypeInput, setSubTypeInput] = useState("");

  // Sync selectedColor from editingType when the sheet opens
  useEffect(() => {
    if (isTypeSheetOpen) {
      setSelectedColor(editingType?.badge_color ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTypeSheetOpen]);

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

  // Real-time check for existing Type + Sub-type combination
  const subTypeConflictError = useMemo(() => {
    if (!typeInput) return null;

    const formattedType = typeInput.trim().toLowerCase();
    const formattedSubType = subTypeInput.trim().toLowerCase();
    if (sheetMode === 'subtype' && subTypeInput) {
      const formattedSubType = subTypeInput.trim().toLowerCase();

      const isDuplicate = initialEventTypes.some(item =>
        item.type.toLowerCase() === formattedType &&
        item.sub_type.toLowerCase() === formattedSubType &&
        item.id !== editingType?.id
      );

      if (isDuplicate) {
        return `"${toTitleCase(subTypeInput)}" already exists in "${toTitleCase(typeInput)}".`;
      }
    }

    if (sheetMode === 'type' && editingType?.type) {
      const oldType = editingType.type.toLowerCase();

      // If the name hasn't actually changed, there's no conflict
      if (oldType === formattedType) return null;

      // 1. Identify all sub-types currently in the group we are renaming
      const subTypesToMigrate = initialEventTypes
        .filter(item => item.type.toLowerCase() === oldType)
        .map(item => item.sub_type.toLowerCase());

      // 2. Identify all sub-types already existing in the target group name
      const existingSubTypesInTarget = initialEventTypes
        .filter(item => item.type.toLowerCase() === formattedType)
        .map(item => item.sub_type.toLowerCase());

      // 3. Find intersections
      const conflicts = subTypesToMigrate.filter(sub => existingSubTypesInTarget.includes(sub));

      if (conflicts.length > 0) {
        const list = conflicts.map(s => `"${toTitleCase(s)}"`).join(", ");
        return `Cannot merge into "${toTitleCase(typeInput)}" because these sub-types already exist there: ${list}.`;
      }
    }
    return null;
  }, [typeInput, subTypeInput, initialEventTypes, editingType, sheetMode]);

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
    // console.log(Object.fromEntries(formData.entries()));
    setTypeSheetError(null);

    const rawType = formData.get("type")?.toString() || typeInput;
    const rawSubType = formData.get("sub_type")?.toString() || subTypeInput;

    const formattedType = rawType.trim().toLowerCase();
    const formattedSubType = rawSubType.trim().toLowerCase();

    if (!formattedType) {
      setTypeSheetError("The primary type name is required.");
      return;
    }

    if (sheetMode === 'type' && editingType?.type) {
      const oldType = editingType.type.toLowerCase();

      if (oldType === formattedType) {
        setIsTypeSheetOpen(false);
        return;
      }

      if (isCustomType && uniqueTypes.some(t => t.toLowerCase() === formattedType)) {
        setTypeSheetError(`The type "${toTitleCase(formattedType)}" already exists.`);
        return;
      }

      startTransition(async () => {
        const result = await renameEventTypeGroupAction(oldType, formattedType);
        if (result?.error) {
          setTypeSheetError(result.error);
        } else {
          setIsTypeSheetOpen(false);
        }
      });
      return;
    }

    if (subTypeConflictError) return;

    formData.set("type", formattedType);
    formData.set("sub_type", formattedSubType);

    startTransition(async () => {
      const result = await saveEventTypeAction(formData);
      if (result?.error) {
        setTypeSheetError(result.error);
      } else {
        setIsTypeSheetOpen(false);
        setIsCustomType(false);
      }
    });
  };

  const handleDeleteGroup = async (type: string) => {
    const formatted = toTitleCase(type);
    const ok = await confirm({
      title: `Delete "${formatted}"`,
      description: `This will delete the entire "${formatted}" category, including all its sub-types and linked information.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteEventTypeGroupAction(type);
      if (result?.error) alert(result.error);
    });
  };

  const handleDeleteSubType = async (id: number) => {
    const ok = await confirm({
      title: "Delete sub-type",
      description: "This will delete this sub-type and all its linked information.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteEventTypeAction(id);
      if (result?.error) alert(result.error);
    });
  };

  const handleInfoSubmit = (formData: FormData) => {
    // console.log("Submitting Event Info Form with data:", Object.fromEntries(formData.entries()));

    startTransition(async () => {
      const result = await saveEventInfoAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        setIsInfoSheetOpen(false);
      }
    });
  };

  const handleDeleteInfo = async (id: number) => {
    const ok = await confirm({
      title: "Delete information item",
      description: "Delete this information item? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteEventInfoAction(id);
      if (result?.error) alert(result.error);
    });
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
          <p className="text-sm text-muted-foreground">
            Manage your event categories and specific requirements.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const defaultSubType = "General";
            setEditingType({ sub_type: defaultSubType });
            setSheetMode('type');
            setTypeSheetError(null);
            setIsCustomType(true);
            setSelectedTypeValue("custom");
            setTypeInput("");
            setSubTypeInput(defaultSubType);
            setIsTypeSheetOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {groupedEventTypes.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-muted/10 border-dashed">
            <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">No Event Categories Configured</h3>
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
                    <div className="flex items-center gap-2 sm:gap-3">
                      <h4 className="text-base font-black tracking-tight text-foreground truncate">
                        {toTitleCase(typeKey)}
                      </h4>
                      <span className="inline-flex items-center bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0">
                        {items.length} {items.length === 1 ? 'Sub-Category' : 'Sub-Categories'}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center pr-2 sm:pr-4 gap-1 sm:gap-2">
                    <div className="hidden sm:flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="xs"
                        className="h-7 px-2 rounded-lg border-primary/20 text-primary font-bold uppercase tracking-wider text-[9px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          const val = toTitleCase(typeKey);
                          const defaultSubType = "";
                          setEditingType({ type: val, sub_type: defaultSubType });
                          setSelectedTypeValue(val);
                          setSheetMode('subtype');
                          setTypeSheetError(null);
                          setIsCustomType(false);
                          setTypeInput(val);
                          setSubTypeInput(defaultSubType);
                          setIsTypeSheetOpen(true);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Sub-Category
                      </Button>

                      {items.length > 0 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              const val = toTitleCase(items[0].type);
                              const subVal = toTitleCase(items[0].sub_type);
                              setEditingType({
                                ...items[0],
                                type: val,
                                sub_type: subVal
                              });
                              setSelectedTypeValue(val);
                              setSheetMode('type');
                              setTypeSheetError(null);
                              setIsCustomType(false);
                              setTypeInput(val);
                              setSubTypeInput(subVal);
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
                              handleDeleteGroup(typeKey);
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
                        <DropdownMenuContent align="end" className="z-9999">
                          {items.length > 0 && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                const val = toTitleCase(items[0].type);
                                const subVal = toTitleCase(items[0].sub_type);
                                setEditingType({
                                  ...items[0],
                                  type: val,
                                  sub_type: subVal
                                });
                                setSelectedTypeValue(val);
                                setSheetMode('type');
                                setTypeSheetError(null);
                                setIsCustomType(false);
                                setTypeInput(val);
                                setSubTypeInput(subVal);
                                setIsTypeSheetOpen(true);
                              }}>
                                <Edit2 className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteGroup(typeKey)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => {
                            const val = toTitleCase(typeKey);
                            const defaultSubType = "";
                            setEditingType({ type: val, sub_type: defaultSubType });
                            setSelectedTypeValue(val);
                            setSheetMode('subtype');
                            setTypeSheetError(null);
                            setIsCustomType(false);
                            setTypeInput(val);
                            setSubTypeInput(defaultSubType);
                            setIsTypeSheetOpen(true);
                          }}>
                            <Plus className="w-4 h-4 mr-2" /> Sub-Category
                          </DropdownMenuItem>
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
                  <div className="py-2 px-4 mr-4 space-y-2 bg-background/50 border-t border-slate-100 dark:border-slate-800">
                    {items.map((item) => (
                      <div key={item.id} className="border rounded-xl bg-card overflow-hidden border-slate-200 dark:border-slate-800">
                        <div className="p-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleSubtypeExpand(item.id)}
                            className="flex-1 flex items-center gap-3 p-2 hover:bg-muted/5 transition-colors text-left"
                          >
                            <span className="font-bold text-sm text-foreground">
                              {toTitleCase(item.sub_type)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium ml-1">({item.event_information?.length || 0} badges)</span>
                          </button>

                          <div className="flex items-center gap-1 pr-1">
                            <div className="hidden sm:flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                onClick={() => {
                                  const val = toTitleCase(item.type);
                                  const subVal = toTitleCase(item.sub_type);
                                  setEditingType({
                                    ...item,
                                    type: val,
                                    sub_type: subVal
                                  });
                                  setSelectedTypeValue(val);
                                  setSheetMode('subtype');
                                  setTypeSheetError(null);
                                  setIsCustomType(false);
                                  setTypeInput(val);
                                  setSubTypeInput(subVal);
                                  setIsTypeSheetOpen(true);
                                }}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSubType(item.id)}
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
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    const val = toTitleCase(item.type);
                                    const subVal = toTitleCase(item.sub_type);
                                    setEditingType({
                                      ...item,
                                      type: val,
                                      sub_type: subVal
                                    });
                                    setSelectedTypeValue(val);
                                    setSheetMode('subtype');
                                    setTypeSheetError(null);
                                    setIsCustomType(false);
                                    setTypeInput(val);
                                    setSubTypeInput(subVal);
                                    setIsTypeSheetOpen(true);
                                  }}>
                                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteSubType(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="shrink-0">
                              {expandedSubtype === item.id ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </div>
                        </div>

                        {/* Information Items */}
                        {expandedSubtype === item.id && (
                          <div className="px-3 pb-3 pt-1 border-t bg-muted/5 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center justify-between mb-3 mt-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Display Badges</span>
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
                                <Plus className="w-3 h-3 mr-1" /> Badge
                              </Button>
                            </div>

                            {item.event_information.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic p-4 text-center">No additional badges added.</p>
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
                                        <DropdownMenuContent align="end">
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

      {/* --- ADD/EDIT EVENT TYPE SHEET --- */}
      <Sheet open={isTypeSheetOpen} onOpenChange={(open) => {
        setIsTypeSheetOpen(open);
        if (!open) {
          setIsCustomType(false);
          setTypeSheetError(null);
          setTypeInput("");
          setSubTypeInput("");
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-md h-full flex flex-col p-0 gap-0 border-l border-border/50">
          {/* <div className="flex flex-col h-full overflow-hidden"> */}
          <SheetHeader className="px-6 pt-6 pb-4 text-left border-b border-border/40 shrink-0">
            <SheetTitle className="text-xl font-bold">
              {sheetMode === 'type'
                ? (editingType?.type ? `Rename Type: ${toTitleCase(typeInput)}` : "Add Event Category")
                : (editingType?.id ? "Edit Category" : "Add Category")
              }
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {sheetMode === 'type'
                ? "Manage the primary category for these events."
                : `Defining a specific category within the ${typeInput || 'selected'} category.`
              }
            </SheetDescription>
          </SheetHeader>

          <form action={handleTypeSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background/50">
            {editingType?.id && <input type="hidden" name="id" value={editingType.id} />}

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Event Type Input/Selection */}
              <div className="space-y-3">
                <Label htmlFor="type-select" className="text-sm font-semibold text-foreground">
                  Category <span className="text-destructive">*</span>
                </Label>

                <div className="space-y-4">
                  <div className="relative group">
                    <select
                      id="type-select"
                      title="Category Selection"
                      name="type-select"
                      required={!isCustomType}
                      value={selectedTypeValue}
                      className="flex h-12 sm:h-11 w-full rounded-xl sm:rounded-lg border border-input bg-background px-4 py-2 text-base sm:text-sm appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTypeValue(val);
                        if (val === "custom") {
                          setIsCustomType(true);
                          setTypeInput(""); // User needs to enter the name
                        } else {
                          setIsCustomType(false);
                          setTypeInput(val);
                        }
                      }}
                    >
                      <option value="" disabled>Select an event category...</option>
                      {uniqueTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="custom" className="font-bold text-primary">+ New Category...</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-muted-foreground">
                      <ChevronDown className="h-5 w-5" />
                    </div>

                    {!isCustomType && (
                      <input type="hidden" name="type" value={typeInput} />
                    )}
                  </div>

                  {isCustomType && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 bg-muted/30 p-4 rounded-2xl border border-border/50">
                      <Label htmlFor="custom-type" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Enter New Category Name
                      </Label>
                      <div className="flex gap-3">
                        <Input
                          id="custom-type"
                          name="type"
                          placeholder="e.g. Music, Game Nights..."
                          required
                          value={typeInput}
                          onChange={(e) => setTypeInput(e.target.value)}
                          autoFocus
                          className="h-12 sm:h-11 rounded-xl sm:rounded-lg px-4 text-base sm:text-sm shadow-sm bg-background"
                        />
                        {uniqueTypes.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setIsCustomType(false);
                              setSelectedTypeValue("");
                              setTypeInput("");
                            }}
                            className="h-12 w-12 sm:h-11 sm:w-11 shrink-0 rounded-xl sm:rounded-lg shadow-sm bg-background hover:bg-muted"
                            title="Back to list"
                          >
                            <RotateCcw className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Show Sub-type ONLY if NOT renaming a group (sheetMode type with editing ID) */}
              {(sheetMode === 'subtype' || !editingType?.id) && (
                <div className="space-y-3">
                  <Label htmlFor="sub_type" className="text-sm font-semibold text-foreground">
                    Sub-category <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sub_type"
                    name="sub_type"
                    placeholder="e.g. General"
                    value={subTypeInput}
                    onChange={(e) => setSubTypeInput(e.target.value)}
                    required
                    className="h-12 sm:h-11 rounded-xl sm:rounded-lg px-4 text-base sm:text-sm shadow-sm bg-white"
                  />
                  {!editingType?.id && (
                    <p className="text-xs text-muted-foreground italic px-1">
                      Every category needs at least one sub-category to be created.
                    </p>
                  )}
                </div>
              )}

              {/* Badge colour picker — shown for sub-type forms only */}
              {(sheetMode === 'subtype' || !editingType?.id) && (
                <div className="space-y-3">
                  <input type="hidden" name="badge_color" value={selectedColor ?? ""} />
                  <Label className="text-sm font-semibold text-foreground">Badge Colour</Label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {EVENT_TYPE_COLORS.map(c => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setSelectedColor(selectedColor === c.key ? null : c.key)}
                        className={cn(
                          "w-7 h-7 rounded-full transition-all",
                          c.swatchClass,
                          selectedColor === c.key ? "swatch-selected scale-110" : "opacity-70 hover:opacity-100"
                        )}
                        title={c.key}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedColor(null)}
                      className={cn(
                        "w-7 h-7 rounded-full bg-[#F7F4EA] transition-all",
                        !selectedColor ? "swatch-selected scale-110" : "opacity-70 hover:opacity-100"
                      )}
                      title="default"
                    />
                  </div>
                  {/* Live preview */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Preview:</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                      badgeClassFromColor(selectedColor)
                    )}>
                      {subTypeInput || "Sub-type"}
                    </span>
                  </div>
                </div>
              )}

              {/* REAL-TIME VALIDATION MESSAGE - VISIBLE FOR ALL MODES */}
              {subTypeConflictError && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 shadow-sm">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <h5 className="text-xs font-black text-destructive uppercase tracking-widest">Conflict Detected</h5>
                    <p className="text-sm text-destructive/90 font-medium leading-snug">{subTypeConflictError}</p>
                  </div>
                </div>
              )}

              {/* SERVER-SIDE ERROR DISPLAY */}
              {typeSheetError && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 shadow-sm">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <h5 className="text-xs font-black text-destructive uppercase tracking-widest">Configuration Error</h5>
                    <p className="text-sm text-destructive/90 font-medium leading-snug">{typeSheetError}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border/40 bg-card/95 backdrop-blur p-4 pb-10 sm:pb-4 sm:px-6 flex flex-row justify-end gap-3 z-10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTypeSheetOpen(false)}
                disabled={isPending}
                className="flex-1 sm:flex-none h-12 sm:h-10 rounded-xl sm:rounded-lg font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !!subTypeConflictError}
                className="flex-1 sm:flex-none h-12 sm:h-10 rounded-xl sm:rounded-lg font-bold shadow-md"
              >
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingType?.id || (sheetMode === 'type' && editingType?.type) ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <Sheet open={isInfoSheetOpen} onOpenChange={setIsInfoSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md h-full flex flex-col p-0 gap-0 border-l border-border/50">

          <SheetHeader className="px-6 pt-6 pb-4 text-left border-b border-border/40 shrink-0">
            <SheetTitle className="text-xl font-bold">
              {editingInfo ? `Edit Detail` : "Add Detail"}
            </SheetTitle>
            <SheetDescription className="text-sm">
              Provide specific parameters and icons for this event category.
            </SheetDescription>
          </SheetHeader>

          <form action={handleInfoSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background/50">
            {editingInfo && <input type="hidden" name="id" value={editingInfo.id} />}
            <input type="hidden" name="event_types_id" value={activeTypeId || ""} />
            <input type="hidden" name="icon" value={selectedIcon} />

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="space-y-3">
                <Label htmlFor="title" className="text-sm font-semibold text-foreground">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g. Every Thursday"
                  defaultValue={editingInfo?.title || ""}
                  required
                  className="h-12 sm:h-11 rounded-xl sm:rounded-lg px-4 text-base sm:text-sm shadow-sm"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-semibold text-foreground">
                  Description
                </Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="e.g. 8:00PM start"
                  defaultValue={editingInfo?.description || ""}
                  className="h-12 sm:h-11 rounded-xl sm:rounded-lg px-4 text-base sm:text-sm shadow-sm"
                />
              </div>
              <div className="space-y-4 pt-2">
                <Label className="text-sm font-semibold text-foreground">Select Icon</Label>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-3 pt-1">
                  {Object.entries(ICON_OPTIONS).map(([name, IconComponent]) => (
                    <button
                      key={name}
                      title={name}
                      type="button"
                      onClick={() => setSelectedIcon(name)}
                      className={cn(
                        "flex items-center justify-center aspect-square rounded-xl border transition-all duration-200 active:scale-95",
                        selectedIcon === name
                          ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/20 scale-105'
                          : 'hover:bg-muted bg-background text-muted-foreground border-border/60 hover:border-border'
                      )}
                    >
                      <IconComponent className="w-6 h-6 sm:w-5 sm:h-5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-border/40 bg-card/95 backdrop-blur p-4 pb-10 sm:pb-4 sm:px-6 flex flex-row justify-end gap-3 z-10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInfoSheetOpen(false)}
                disabled={isPending}
                className="flex-1 sm:flex-none h-12 sm:h-10 rounded-xl sm:rounded-lg font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 sm:flex-none h-12 sm:h-10 rounded-xl sm:rounded-lg font-bold shadow-md"
              >
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingInfo ? "Update" : "Save"}
              </Button>
            </div>
          </form>

        </SheetContent>
      </Sheet>
      {ConfirmDialogUI}
    </div>
  );
}
