export type EventSlot = {
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

function isSet(value: string | null | undefined): boolean {
  return !!value && value.trim() !== "";
}

export function eventSlotIsComplete(slot: EventSlot): boolean {
  return isSet(slot.date) && isSet(slot.startTime) && isSet(slot.endTime);
}

export function resolveEventIsActive(requested: boolean, slot: EventSlot): boolean {
  return requested && eventSlotIsComplete(slot);
}
