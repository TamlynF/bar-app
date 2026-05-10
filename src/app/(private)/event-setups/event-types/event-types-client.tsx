"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Edit2, Trash2, Layers, Info, Image as ImageIcon, Loader2,
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Beer,
  ChevronDown, Banknote, Trophy, Wine,
  MoreVertical, Speaker, User
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
  information?: string | null;
  type_color?: string | null;
  default_title?: string | null;
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
  const [selectedTypeColor, setSelectedTypeColor] = useState<string | null>(null);
  const [defaultTitleInput, setDefaultTitleInput] = useState("");

  // Sync color/title state from editingType when the sheet opens
  useEffect(() => {
    if (isTypeSheetOpen) {
      setSelectedColor(editingType?.badge_color ?? null);
      setDefaultTitleInput(editingType?.default_title ?? "");
      const groupItems = initialEventTypes.filter(
        i => i.type.toLowerCase() === (editingType?.type ?? "").toLowerCase()
      );
      setSelectedTypeColor(groupItems[0]?.type_color ?? null);
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

      if (oldType === formattedType) return null;

      const subTypesToMigrate = initialEventTypes
        .filter(item => item.type.toLowerCase() === oldType)
        .map(item => item.sub_type.toLowerCase());

      const existingSubTypesInTarget = initialEventTypes
        .filter(item => item.type.toLowerCase() === formattedType)
        .map(item => item.sub_type.toLowerCase());

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

      if (isCustomType && oldType !== formattedType && uniqueTypes.some(t => t.toLowerCase() === formattedType)) {
        setTypeSheetError(`The type "${toTitleCase(formattedType)}" already exists.`);
        return;
      }

      startTransition(async () => {
        const result = await renameEventTypeGroupAction(oldType, formattedType, selectedTypeColor);
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
    formData.set("default_title", defaultTitleInput.trim());

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
      return <ImageIcon className="w-4 h-4 text-[#5F624F]" />;
    }
    const SelectedIcon = ICON_OPTIONS[iconStr as keyof typeof ICON_OPTIONS];
    return <SelectedIcon className="w-4 h-4" />;
  };

  // Helper: open sub-category edit
  const openSubCategoryEdit = (item: EventTypeRecord) => {
    const val = toTitleCase(item.type);
    const subVal = toTitleCase(item.sub_type);
    setEditingType({ ...item, type: val, sub_type: subVal });
    setSelectedTypeValue(val);
    setSheetMode('subtype');
    setTypeSheetError(null);
    setIsCustomType(false);
    setTypeInput(val);
    setSubTypeInput(subVal);
    setIsTypeSheetOpen(true);
  };

  // Helper: open category edit
  const openCategoryEdit = (items: EventTypeRecord[]) => {
    const val = toTitleCase(items[0].type);
    const subVal = toTitleCase(items[0].sub_type);
    setEditingType({ ...items[0], type: val, sub_type: subVal });
    setSelectedTypeValue(val);
    setSheetMode('type');
    setTypeSheetError(null);
    setIsCustomType(false);
    setTypeInput(val);
    setSubTypeInput(subVal);
    setIsTypeSheetOpen(true);
  };

  // Helper: open add sub-category
  const openAddSubCategory = (typeKey: string) => {
    const val = toTitleCase(typeKey);
    setEditingType({ type: val, sub_type: "" });
    setSelectedTypeValue(val);
    setSheetMode('subtype');
    setTypeSheetError(null);
    setIsCustomType(false);
    setTypeInput(val);
    setSubTypeInput("");
    setIsTypeSheetOpen(true);
  };

  return (
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#5F624F]">
          Manage your event categories and requirements.
        </p>
        <button
          type="button"
          onClick={() => {
            setEditingType({ sub_type: "General" });
            setSheetMode('type');
            setTypeSheetError(null);
            setIsCustomType(true);
            setSelectedTypeValue("custom");
            setTypeInput("");
            setSubTypeInput("General");
            setIsTypeSheetOpen(true);
          }}
          className="h-8 px-3 rounded-lg bg-[#26300D] text-[#FDCC4B] hover:bg-[#26300D]/85 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-wide">New</span>
        </button>
      </div>

      <div className="space-y-2">
        {groupedEventTypes.length === 0 ? (
          <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
            <Layers className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
            <p className="text-sm font-black text-[#1F1F1A]">No Event Categories</p>
            <p className="text-[11px] text-[#5F624F] mt-1">Add your first category to get started</p>
          </div>
        ) : (
          groupedEventTypes.map(([typeKey, items]) => {
            const isGroupExpanded = expandedGroups.has(typeKey) || groupedEventTypes.length === 1;
            const groupTypeColor = items[0]?.type_color ?? null;

            return (
              <section key={typeKey} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
                {/* Category Header */}
                <div className="flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleGroup(typeKey)}
                    className="flex-1 min-w-0 text-left flex items-center gap-2"
                  >
                    {groupTypeColor && (
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        EVENT_TYPE_COLORS.find(c => c.key === groupTypeColor)?.swatchClass ?? "bg-[#E6DFC8]"
                      )} />
                    )}
                    <p className="text-[11px] font-black uppercase tracking-wide text-[#26300D] truncate">
                      {toTitleCase(typeKey)}
                    </p>
                    <span className="text-[10px] font-black text-[#5F624F] shrink-0">
                      ({items.length})
                    </span>
                  </button>

                  {/* Desktop actions */}
                  <div className="hidden sm:flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openAddSubCategory(typeKey)}
                      className="h-7 px-2.5 rounded-lg bg-[#26300D] text-[#FDCC4B] hover:bg-[#26300D]/85 transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-wide">Sub-Category</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#5F624F] hover:text-[#26300D]"
                      onClick={() => openCategoryEdit(items)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteGroup(typeKey)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Mobile 3-dot */}
                  <div className="sm:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5F624F]" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-9999 bg-white border-[#E6DFC8] shadow-lg min-w-[200px]">
                        <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => openAddSubCategory(typeKey)}>
                          <Plus className="w-4 h-4 mr-3 text-[#26300D] stroke-[2.5]" /> Add Sub-Category
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                        <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => openCategoryEdit(items)}>
                          <Edit2 className="w-4 h-4 mr-3 text-[#26300D] stroke-[2.5]" /> Edit Category
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                        <DropdownMenuItem
                          className="py-3 text-[13px] text-red-600 font-medium focus:text-red-600"
                          onClick={() => handleDeleteGroup(typeKey)}
                        >
                          <Trash2 className="w-4 h-4 mr-3 text-red-500 stroke-[2.5]" /> Delete Category
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <button type="button" onClick={() => toggleGroup(typeKey)} className="shrink-0" title="Toggle group">
                    <ChevronDown className={cn(
                      "w-4 h-4 text-[#5F624F] transition-transform duration-200",
                      isGroupExpanded && "rotate-180"
                    )} />
                  </button>
                </div>

                {/* Sub-categories */}
                {isGroupExpanded && (
                  <div className="ml-3 sm:ml-4 mr-1 sm:mr-2 my-2 rounded-xl bg-[#F7F4EA]/50 border border-[#E6DFC8] overflow-hidden divide-y divide-[#E6DFC8]">
                    {items.map((item) => {
                      const isExpanded = expandedSubtype === item.id;
                      const badgeCount = item.event_information?.length || 0;

                      return (
                        <div key={item.id}>
                          {/* Sub-category row */}
                          <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSubtypeExpand(item.id)}
                              className="flex-1 min-w-0 text-left flex items-center gap-2"
                            >
                              <span className={cn(
                                "w-2.5 h-2.5 rounded-full shrink-0",
                                item.badge_color
                                  ? EVENT_TYPE_COLORS.find(c => c.key === item.badge_color)?.swatchClass ?? "bg-[#E6DFC8]"
                                  : "bg-[#E6DFC8]"
                              )} />
                              <span className="text-xs font-bold text-[#1F1F1A] truncate">
                                {toTitleCase(item.sub_type)}
                              </span>
                              <span className="text-[10px] text-[#5F624F] shrink-0">
                                {badgeCount} {badgeCount === 1 ? "badge" : "badges"}
                              </span>
                            </button>

                            {/* Desktop actions */}
                            <div className="hidden sm:flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#5F624F] hover:text-[#26300D]"
                                onClick={() => openSubCategoryEdit(item)}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSubType(item.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>

                            {/* Mobile 3-dot */}
                            <div className="sm:hidden">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5F624F]">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="z-9999 bg-white border-[#E6DFC8] shadow-lg min-w-[180px]">
                                  <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => {
                                    setEditingInfo(null);
                                    setActiveTypeId(item.id);
                                    setSelectedIcon("");
                                    setIsInfoSheetOpen(true);
                                  }}>
                                    <Plus className="w-4 h-4 mr-3 text-[#26300D] stroke-[2.5]" /> Add Badge
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                                  <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => openSubCategoryEdit(item)}>
                                    <Edit2 className="w-4 h-4 mr-3 text-[#26300D] stroke-[2.5]" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                                  <DropdownMenuItem
                                    className="py-3 text-[13px] text-red-600 font-medium focus:text-red-600"
                                    onClick={() => handleDeleteSubType(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-3 text-red-500 stroke-[2.5]" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleSubtypeExpand(item.id)}
                              className="shrink-0"
                              title="Toggle details"
                            >
                              <ChevronDown className={cn(
                                "w-3.5 h-3.5 text-[#5F624F] transition-transform duration-200",
                                isExpanded && "rotate-180"
                              )} />
                            </button>
                          </div>

                          {/* Expanded sub-category details */}
                          {isExpanded && (
                            <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-[#E6DFC8] animate-in fade-in slide-in-from-top-1 space-y-2">
                              {/* Booking description preview */}
                              {item.information && (
                                <div className="px-3 py-2.5 bg-white border border-[#E6DFC8] rounded-lg">
                                  <p className="text-[9px] font-black uppercase tracking-wide text-[#5F624F] mb-1">Booking Page Description</p>
                                  <p className="text-[11px] text-[#1F1F1A] leading-relaxed">{item.information}</p>
                                </div>
                              )}

                              {/* Default title preview */}
                              {item.default_title && (
                                <div className="px-3 py-2.5 bg-white border border-[#E6DFC8] rounded-lg">
                                  <p className="text-[9px] font-black uppercase tracking-wide text-[#5F624F] mb-1">Default Event Title</p>
                                  <p className="text-[11px] text-[#1F1F1A] leading-relaxed">{item.default_title}</p>
                                </div>
                              )}

                              {/* Badges container */}
                              <div className="bg-white border border-[#E6DFC8] rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-[#E6DFC8]/50 bg-[#F7F4EA]/50">
                                  <span className="text-[9px] font-black uppercase tracking-wide text-[#5F624F]">Display Badges</span>
                                  {/* Desktop + Badge button */}
                                  <button
                                    type="button"
                                    className="hidden sm:flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#26300D] hover:text-[#26300D]/70"
                                    onClick={() => {
                                      setEditingInfo(null);
                                      setActiveTypeId(item.id);
                                      setSelectedIcon("");
                                      setIsInfoSheetOpen(true);
                                    }}
                                  >
                                    <Plus className="w-3 h-3" /> Add
                                  </button>
                                </div>

                                {item.event_information.length === 0 ? (
                                  <p className="text-[11px] text-[#5F624F] italic text-center py-4">No badges added yet.</p>
                                ) : (
                                  <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {item.event_information.map((info) => (
                                      <div key={info.id} className="flex items-center gap-2.5 px-3 py-2 border border-[#E6DFC8] rounded-lg bg-[#F7F4EA]/30 relative group">
                                        <div className="shrink-0 w-7 h-7 flex items-center justify-center bg-[#F7F4EA] text-[#26300D] rounded-lg">
                                          {renderIcon(info.icon)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-bold text-[#1F1F1A] leading-none mb-0.5 truncate">{info.title}</p>
                                          {info.description && (
                                            <p className="text-[10px] text-[#5F624F] truncate">{info.description}</p>
                                          )}
                                        </div>

                                        {/* Mobile badge actions */}
                                        <div className="sm:hidden shrink-0">
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-[#5F624F]">
                                                <MoreVertical className="w-3 h-3" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="z-9999 bg-white border-[#E6DFC8] shadow-lg min-w-[160px]">
                                              <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => {
                                                setEditingInfo(info);
                                                setActiveTypeId(item.id);
                                                setSelectedIcon(info.icon || "");
                                                setIsInfoSheetOpen(true);
                                              }}>
                                                <Edit2 className="w-4 h-4 mr-3 text-[#26300D] stroke-[2.5]" /> Edit
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                                              <DropdownMenuItem
                                                className="py-3 text-[13px] text-red-600 font-medium focus:text-red-600"
                                                onClick={() => handleDeleteInfo(info.id)}
                                              >
                                                <Trash2 className="w-4 h-4 mr-3 text-red-500 stroke-[2.5]" /> Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>

                                        {/* Desktop hover actions */}
                                        <div className="absolute top-1.5 right-1.5 hidden sm:flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button
                                            variant="ghost"
                                            className="p-1 h-auto text-[#5F624F] hover:text-[#26300D]"
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
                                            variant="ghost"
                                            className="p-1 h-auto text-destructive hover:bg-destructive/10 rounded"
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
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
          setSelectedTypeColor(null);
          setDefaultTitleInput("");
        }
      }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px]
            sm:h-auto sm:max-h-[80vh] sm:rounded-[2rem] sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight">
              {sheetMode === 'type'
                ? (editingType?.type ? "Edit Category" : "New Category")
                : (editingType?.id ? "Edit Sub-Category" : "New Sub-Category")
              }
            </SheetTitle>
            <SheetDescription className="text-[11px] text-[#5F624F] mt-1">
              {sheetMode === 'type'
                ? "Manage the primary category for these events."
                : `Defining a sub-category within "${typeInput || 'selected'}".`
              }
            </SheetDescription>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4 sm:space-y-5">
            <form id="type-form" action={handleTypeSubmit} className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
              {editingType?.id && <input type="hidden" name="id" value={editingType.id} />}

              {/* ===== CATEGORY SECTION ===== */}
              <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60">
                  <span className="text-[11px] font-black uppercase tracking-wide text-[#26300D]">Category</span>
                </div>

                {/* Category Name */}
                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
                  <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">Name</span>
                    <span className="text-red-500 text-[10px] font-black">*</span>
                  </div>
                  {(isCustomType || sheetMode === 'type') ? (
                    <input
                      id="type-input"
                      name="type"
                      required
                      placeholder="e.g. Music, Games..."
                      value={typeInput}
                      onChange={(e) => setTypeInput(e.target.value)}
                      autoFocus={isCustomType}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  ) : (
                    <>
                      <select
                        id="type-select"
                        title="Category Selection"
                        name="type-select"
                        required={!isCustomType}
                        value={selectedTypeValue}
                        className="text-xs sm:text-sm font-black text-[#1F1F1A] flex-1 bg-transparent outline-none appearance-none cursor-pointer dir-rtl"
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedTypeValue(val);
                          if (val === "custom") {
                            setIsCustomType(true);
                            setTypeInput("");
                          } else {
                            setIsCustomType(false);
                            setTypeInput(val);
                          }
                        }}
                      >
                        <option value="" disabled className="dir-ltr">Select a category...</option>
                        {uniqueTypes.map(t => (
                          <option key={t} value={t} className="dir-ltr">{t}</option>
                        ))}
                        <option value="custom" className="dir-ltr">+ New Category...</option>
                      </select>
                      {!isCustomType && <input type="hidden" name="type" value={typeInput} />}
                    </>
                  )}
                </div>

                {/* Back to list link (only for custom type in subtype mode) */}
                {isCustomType && sheetMode !== 'type' && uniqueTypes.length > 0 && (
                  <div className="px-4 sm:px-5 py-2">
                    <button
                      type="button"
                      onClick={() => { setIsCustomType(false); setSelectedTypeValue(""); setTypeInput(""); }}
                      className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] underline hover:text-[#26300D]"
                    >
                      Select from existing
                    </button>
                  </div>
                )}

                {/* Category Colour — type mode only */}
                {sheetMode === 'type' && (
                  <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
                    <input type="hidden" name="type_color" value={selectedTypeColor ?? ""} />
                    <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60">
                      <span className="text-[10px] font-black uppercase tracking-wide">Colour</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {EVENT_TYPE_COLORS.map(c => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setSelectedTypeColor(selectedTypeColor === c.key ? null : c.key)}
                          className={cn(
                            "w-7 h-7 rounded-full transition-all",
                            c.swatchClass,
                            selectedTypeColor === c.key ? "swatch-selected scale-110" : "opacity-70 hover:opacity-100"
                          )}
                          title={c.key}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedTypeColor(null)}
                        className={cn(
                          "w-7 h-7 rounded-full bg-[#F7F4EA] transition-all",
                          !selectedTypeColor ? "swatch-selected scale-110" : "opacity-70 hover:opacity-100"
                        )}
                        title="default"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#5F624F]">Preview:</span>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md border",
                        badgeClassFromColor(selectedTypeColor)
                      )}>
                        {typeInput || "Category"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== SUB-CATEGORY SECTION ===== */}
              {(sheetMode === 'subtype' || !editingType?.id) && (
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                  <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#26300D]">Sub-Category</span>
                  </div>

                  {/* Sub-category Name */}
                  <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
                    <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">Name</span>
                      <span className="text-red-500 text-[10px] font-black">*</span>
                    </div>
                    <input
                      id="sub_type"
                      name="sub_type"
                      required
                      placeholder="e.g. General"
                      value={subTypeInput}
                      onChange={(e) => setSubTypeInput(e.target.value)}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </div>

                  {!editingType?.id && sheetMode === 'type' && (
                    <div className="px-4 sm:px-5 py-2">
                      <p className="text-[10px] text-[#5F624F] italic">Every category needs at least one sub-category.</p>
                    </div>
                  )}

                  {/* Default Event Title */}
                  <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
                    <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">Default Title</span>
                    </div>
                    <input
                      id="default_title"
                      name="default_title"
                      placeholder="e.g. Quiz Night"
                      value={defaultTitleInput}
                      onChange={(e) => setDefaultTitleInput(e.target.value)}
                      className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                    />
                  </div>

                  {/* Badge Colour */}
                  <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
                    <input type="hidden" name="badge_color" value={selectedColor ?? ""} />
                    <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60">
                      <span className="text-[10px] font-black uppercase tracking-wide">Badge Colour</span>
                    </div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#5F624F]">Preview:</span>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md border",
                        badgeClassFromColor(selectedColor)
                      )}>
                        {subTypeInput || "Sub-type"}
                      </span>
                    </div>
                  </div>

                  {/* Booking Page Description */}
                  <div className="px-4 sm:px-5 py-2.5 sm:py-4">
                    <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wide">Description</span>
                    </div>
                    <textarea
                      id="information"
                      name="information"
                      placeholder="Shown on the public booking page..."
                      defaultValue={editingType?.information ?? ""}
                      rows={2}
                      className="w-full text-xs sm:text-sm font-black text-[#1F1F1A] bg-transparent outline-none placeholder:text-[#5F624F]/40 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Validation / error messages */}
              {subTypeConflictError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-wide">Conflict</p>
                    <p className="text-sm text-red-700 font-bold leading-snug">{subTypeConflictError}</p>
                  </div>
                </div>
              )}

              {typeSheetError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-bold leading-snug">{typeSheetError}</p>
                </div>
              )}
            </form>

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsTypeSheetOpen(false)}
                disabled={isPending}
                className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white hover:bg-[#F7F4EA]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="type-form"
                disabled={isPending || !!subTypeConflictError}
                className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
              >
                {isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editingType?.id || (sheetMode === 'type' && editingType?.type) ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Badge Detail Sheet */}
      <Sheet open={isInfoSheetOpen} onOpenChange={setIsInfoSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px]
            sm:h-auto sm:max-h-[80vh] sm:rounded-[2rem] sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight">
              {editingInfo ? "Edit Badge" : "New Badge"}
            </SheetTitle>
            <SheetDescription className="text-[11px] text-[#5F624F] mt-1">
              Define an icon and label shown on booking pages.
            </SheetDescription>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4 sm:space-y-5">
            <form id="info-form" action={handleInfoSubmit} className="animate-in fade-in duration-200 space-y-4 sm:space-y-5">
              {editingInfo && <input type="hidden" name="id" value={editingInfo.id} />}
              <input type="hidden" name="event_types_id" value={activeTypeId || ""} />
              <input type="hidden" name="icon" value={selectedIcon} />

              <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                {/* Title */}
                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
                  <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">Title</span>
                    <span className="text-red-500 text-[10px] font-black">*</span>
                  </div>
                  <input
                    name="title"
                    required
                    placeholder="e.g. Every Thursday"
                    defaultValue={editingInfo?.title || ""}
                    className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                  />
                </div>

                {/* Description */}
                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
                  <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">Description</span>
                  </div>
                  <input
                    name="description"
                    placeholder="e.g. 8:00PM start"
                    defaultValue={editingInfo?.description || ""}
                    className="text-xs sm:text-sm font-black text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40"
                  />
                </div>

                {/* Icon picker */}
                <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60">
                    <span className="text-[10px] font-black uppercase tracking-wide">Icon</span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                    {Object.entries(ICON_OPTIONS).map(([name, IconComponent]) => (
                      <button
                        key={name}
                        title={name}
                        type="button"
                        onClick={() => setSelectedIcon(name)}
                        className={cn(
                          "flex items-center justify-center aspect-square rounded-xl border transition-all duration-200 active:scale-95",
                          selectedIcon === name
                            ? "bg-[#26300D] text-[#FDCC4B] border-[#26300D] shadow-md ring-2 ring-[#26300D]/20 scale-105"
                            : "hover:bg-[#F7F4EA] bg-white text-[#5F624F] border-[#E6DFC8] hover:border-[#26300D]/30"
                        )}
                      >
                        <IconComponent className="w-5 h-5 sm:w-4 sm:h-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </form>

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsInfoSheetOpen(false)}
                disabled={isPending}
                className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white hover:bg-[#F7F4EA]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="info-form"
                disabled={isPending}
                className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
              >
                {isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editingInfo ? "Update" : "Save"}
              </Button>
            </div>
          </div>

          {ConfirmDialogUI}
        </SheetContent>
      </Sheet>
    </div>
  );
}
