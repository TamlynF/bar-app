"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  Users,
  ChevronRight,
  ChevronDown,
  Save,
  Pencil,
  Trash2,
  Hash,
  AlertCircle,
} from "lucide-react";
import { saveContactAction, deleteContactAction } from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type ContactRecord = {
  id: number;
  full_name: string;
  email: string;
  country_code: string | null;
  phone_no: string | null;
  birthday: string | null;
  created_at?: string;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CustomersClient({ initialContacts = [] }: { initialContacts: ContactRecord[] }) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<ContactRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isSheetOpen = !!selected || isAdding;

  const openView = (contact: ContactRecord) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(contact);
  };

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setIsAdding(true);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
  };

  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveContactAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Delete customer",
      description: "Delete this customer contact? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteContactAction(selected.id);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  return (
    <div className="max-w-2xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">

      {/* Customer List */}
      {initialContacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
          <p className="font-black text-sm text-[#1F1F1A]">No customers yet</p>
          <p className="mt-1 text-[11px] text-[#5F624F]">Add your first customer to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          <section className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
            <div className="flex items-center gap-2 bg-[#F7F4EA] px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-black text-[11px] tracking-wide text-[#5C4033] uppercase">
                  Customers <span className="text-[#5F624F]">({initialContacts.length})</span>
                </p>
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="flex h-7 w-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] text-white transition-colors hover:bg-[#1B4332]/85 sm:h-7 sm:w-auto sm:px-2.5"
                title="Add Customer"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden font-black text-[10px] tracking-widest uppercase sm:inline">Create</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="shrink-0"
                title="Toggle group"
              >
                <ChevronDown className={cn(
                  "h-4 w-4 text-[#5F624F] transition-transform duration-200",
                  !isCollapsed && "rotate-180"
                )} />
              </button>
            </div>

            {!isCollapsed && <div className="divide-y divide-[#E6DFC8]/50">
              {initialContacts.map((contact) => {
                const phone = [contact.country_code, contact.phone_no].filter(Boolean).join(" ");
                return (
                  <div
                    key={contact.id}
                    onClick={() => openView(contact)}
                    className="flex cursor-pointer items-center gap-2 px-3 py-3 transition-colors hover:bg-[#F7F4EA]/50 active:scale-[0.99] sm:gap-3 sm:px-4"
                  >
                    {/* Mobile layout */}
                    <div className="min-w-0 flex-1 sm:hidden">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate font-black text-xs leading-snug text-[#1F1F1A]">
                          {contact.full_name}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-[#5F624F]">
                          {contact.email}
                        </p>
                        {contact.birthday && (
                          <span className="shrink-0 font-black text-[10px] text-[#5F624F]">
                            {formatDate(contact.birthday)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden min-w-0 flex-1 sm:block">
                      <p className="truncate font-black text-sm leading-snug text-[#1F1F1A]">
                        {contact.full_name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-[#5F624F]">
                        {contact.email}
                        {phone && (
                          <span className="ml-2 text-[#5F624F]/60">{phone}</span>
                        )}
                      </p>
                    </div>

                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      {contact.birthday && (
                        <span className="rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 font-black text-[11px] text-[#5F624F]">
                          {formatDate(contact.birthday)}
                        </span>
                      )}
                      {phone && (
                        <span className="rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2 py-1 font-black text-[11px] text-[#5F624F]">
                          {phone}
                        </span>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F] opacity-40" />
                  </div>
                );
              })}
            </div>}
          </section>
        </div>
      )}

      {/* Bottom Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8]
            bg-[#F7F4EA] p-0 shadow-2xl outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto
            sm:max-h-[80vh] sm:w-140 sm:-translate-x-1/2 sm:rounded-4xl
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#1F1F1A] uppercase">
                  {isAdding ? "New Customer" : isEditing ? "Edit Customer" : "View Customer"}
                </SheetTitle>
                {selected && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-[#5F624F]" />
                    <span className="font-black text-xs tracking-wide text-[#5F624F] uppercase tabular-nums">
                      ID: {selected.id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">

            {/* View mode */}
            {!showForm && selected && (() => {
              const phone = [selected.country_code, selected.phone_no].filter(Boolean).join(" ");
              return (
                <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                  <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                    <DetailCell label="Full Name" value={selected.full_name} />
                    <DetailCell label="Email" value={selected.email} />
                    <DetailCell label="Phone" value={phone || "—"} />
                    <DetailCell label="Birthday" value={formatDate(selected.birthday)} />
                  </div>

                  {formError && <ErrorBox message={formError} />}
                </div>
              );
            })()}

            {/* Edit / Add form */}
            {showForm && (
              <form id="customer-form" action={handleSubmit} className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
                {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

                <div className="divide-y divide-[#E6DFC8]/50 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white">
                  {/* Full Name */}
                  <FormRow label="Full Name" required>
                    <input
                      name="full_name"
                      required
                      placeholder="e.g. Jane Doe"
                      defaultValue={formDefault?.full_name ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  {/* Email */}
                  <FormRow label="Email" required>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="e.g. jane@example.com"
                      defaultValue={formDefault?.email ?? ""}
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                    />
                  </FormRow>

                  {/* Phone */}
                  <FormRow label="Phone">
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <input
                        name="country_code"
                        placeholder="+44"
                        defaultValue={formDefault?.country_code ?? ""}
                        className="w-16 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                      />
                      <span className="text-xs text-[#5F624F]/50">|</span>
                      <input
                        name="phone_no"
                        type="tel"
                        placeholder="7123 456789"
                        defaultValue={formDefault?.phone_no ?? ""}
                        className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 sm:text-sm"
                      />
                    </div>
                  </FormRow>

                  {/* Birthday */}
                  <FormRow label="Birthday">
                    <input
                      title="Birthday"
                      name="birthday"
                      type="date"
                      defaultValue={
                        formDefault?.birthday
                          ? new Date(formDefault.birthday).toISOString().split("T")[0]
                          : ""
                      }
                      className="flex-1 bg-transparent text-right font-black text-base text-[#1F1F1A] outline-none sm:text-sm"
                    />
                  </FormRow>
                </div>

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="z-40 shrink-0 border-t-2 border-[#E6DFC8] bg-white/80 px-6 py-5 pb-10 backdrop-blur-md sm:rounded-b-4xl sm:pb-5">
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 font-black text-[10px] tracking-wide text-red-500 uppercase hover:border-red-200 hover:bg-red-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 flex-1 rounded-2xl bg-[#B45309] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#B45309]/85 active:scale-95"
                >
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormError(null);
                    if (isAdding) closeSheet();
                    else setIsEditing(false);
                  }}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-wide text-[#5F624F] uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="customer-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#1B4332] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95"
                >
                  {isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Save className="mr-2 h-4 w-4" />Save</>}
                </Button>
              </div>
            )}
          </div>
          {ConfirmDialogUI}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="font-black text-[10px] tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
        {required && <span className="font-black text-[10px] text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[#E6DFC8] px-4 py-2.5 last:border-0 sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5F624F] opacity-60 sm:gap-2">
        <span className="font-black text-[10px] tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
      </div>
      <span className="flex-1 text-right font-black text-base leading-snug break-all text-[#1F1F1A] sm:text-sm">
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <p className="text-sm leading-snug font-bold text-red-700">{message}</p>
    </div>
  );
}
