// Booking configuration stored as JSONB on `event_subtypes.default_booking_config`
// (the default) and `events.booking_config` (the per-event override).
//
// The shape is intentionally a single blob: it's always read whole to render one
// booking form, never queried by individual field. Each form field carries its own
// visibility / label / required flags, plus field-specific attributes.

export type FieldKey = "name" | "email" | "phone" | "group_size" | "group_name" | "special_requests";

export type FieldConfig = {
  visible: boolean;
  label: string;
  required: boolean;
};

export type GroupSizeFieldConfig = FieldConfig & {
  min: number;
  max: number;
};

export type BookingFields = {
  name?: FieldConfig; // always visible + required (label editable)
  email?: FieldConfig; // always visible + required (label editable)
  phone?: FieldConfig;
  group_size?: GroupSizeFieldConfig;
  group_name?: FieldConfig;
  special_requests?: FieldConfig;
};

export type BookingConfig = {
  booking_image_url?: string | null;
  tag_line?: string;
  fields?: BookingFields;
};

/** Fully-resolved config (no optionals) for consumers that need every value present. */
export type ResolvedBookingConfig = {
  booking_image_url: string | null;
  tag_line: string;
  fields: {
    name: FieldConfig;
    email: FieldConfig;
    phone: FieldConfig;
    group_size: GroupSizeFieldConfig;
    group_name: FieldConfig;
    special_requests: FieldConfig;
  };
};

/** Defaults match the historical hardcoded behaviour of the public event form. */
export const DEFAULT_BOOKING_CONFIG: ResolvedBookingConfig = {
  booking_image_url: null,
  tag_line: "",
  fields: {
    name: { visible: true, label: "Your Name", required: true },
    email: { visible: true, label: "Email", required: true },
    phone: { visible: true, label: "Phone No.", required: false },
    group_size: { visible: true, label: "Number of People", required: true, min: 1, max: 10 },
    group_name: { visible: false, label: "Group Name", required: false },
    special_requests: { visible: true, label: "Additional Requests", required: false },
  },
};

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function resolveField(raw: Partial<FieldConfig> | undefined, def: FieldConfig, legacy: { visible?: unknown; label?: unknown } = {}): FieldConfig {
  return {
    visible: asBool(raw?.visible, asBool(legacy.visible, def.visible)),
    label: asString(raw?.label, asString(legacy.label, def.label)),
    required: asBool(raw?.required, def.required),
  };
}

/**
 * Resolve a stored config into a fully-populated `ResolvedBookingConfig`, filling
 * defaults and mapping the legacy flat shape (`collect_phone`, `group_name_label`,
 * `max_group_size`, `custom_tagline`, …) so old DB rows keep rendering. New nested
 * keys take precedence over legacy ones.
 */
export function normalizeBookingConfig(
  raw: BookingConfig | Record<string, unknown> | null | undefined
): ResolvedBookingConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fields = (r.fields ?? {}) as Partial<Record<FieldKey, Partial<GroupSizeFieldConfig>>>;
  const def = DEFAULT_BOOKING_CONFIG;

  const name = resolveField(fields.name, def.fields.name);
  const email = resolveField(fields.email, def.fields.email);

  const groupSizeRaw = fields.group_size;
  const groupSize: GroupSizeFieldConfig = {
    ...resolveField(groupSizeRaw, def.fields.group_size, { visible: r.collect_group_size }),
    min: asNumber(groupSizeRaw?.min, asNumber(r.min_group_size, def.fields.group_size.min)),
    max: asNumber(groupSizeRaw?.max, asNumber(r.max_group_size, def.fields.group_size.max)),
  };

  return {
    booking_image_url: typeof r.booking_image_url === "string" && r.booking_image_url !== "" ? r.booking_image_url : null,
    tag_line: asString(r.tag_line, asString(r.custom_tagline, def.tag_line)),
    fields: {
      // Name & email are always shown and required, regardless of stored value.
      name: { ...name, visible: true, required: true },
      email: { ...email, visible: true, required: true },
      phone: resolveField(fields.phone, def.fields.phone, { visible: r.collect_phone }),
      group_size: groupSize,
      group_name: resolveField(fields.group_name, def.fields.group_name, {
        visible: r.collect_group_name,
        label: r.group_name_label,
      }),
      special_requests: resolveField(fields.special_requests, def.fields.special_requests, {
        visible: r.collect_special_requests,
      }),
    },
  };
}
