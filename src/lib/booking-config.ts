export type FieldKey = "name" | "email" | "phone" | "country_code" | "group_size" | "group_name" | "special_requests";

export type FieldConfig = {
  visible: boolean;
  label: string;
  required: boolean;
};

export type GroupSizeFieldConfig = FieldConfig & {
  min: number;
  max: number;
};

export type CountryCodeFieldConfig = FieldConfig & {
  default_value: string; // "" = no default, the customer picks one
};

export type BookingFields = {
  name?: FieldConfig; // always visible + required (label editable)
  email?: FieldConfig; // always visible + required (label editable)
  phone?: FieldConfig;
  country_code?: CountryCodeFieldConfig; // only applies while phone is shown
  group_size?: GroupSizeFieldConfig;
  group_name?: FieldConfig;
  special_requests?: FieldConfig;
};

export type BookingConfig = {
  booking_image_url?: string | null;
  tag_line?: string;
  fields?: BookingFields;
};

export type ResolvedBookingConfig = {
  booking_image_url: string | null;
  tag_line: string;
  fields: {
    name: FieldConfig;
    email: FieldConfig;
    phone: FieldConfig;
    country_code: CountryCodeFieldConfig;
    group_size: GroupSizeFieldConfig;
    group_name: FieldConfig;
    special_requests: FieldConfig;
  };
};

export const DEFAULT_BOOKING_CONFIG: ResolvedBookingConfig = {
  booking_image_url: null,
  tag_line: "",
  fields: {
    name: { visible: true, label: "Your Name", required: true },
    email: { visible: true, label: "Email", required: true },
    phone: { visible: true, label: "Phone No.", required: false },
    country_code: { visible: true, label: "Country Code", required: false, default_value: "+44" },
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

export function normalizeBookingConfig(
  raw: BookingConfig | Record<string, unknown> | null | undefined
): ResolvedBookingConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fields = (r.fields ?? {}) as Partial<Record<FieldKey, Partial<GroupSizeFieldConfig & CountryCodeFieldConfig>>>;
  const def = DEFAULT_BOOKING_CONFIG;

  const name = resolveField(fields.name, def.fields.name);
  const email = resolveField(fields.email, def.fields.email);

  const phone = resolveField(fields.phone, def.fields.phone, { visible: r.collect_phone });
  const countryCodeRaw = fields.country_code;
  const countryCodeDefault =
    typeof countryCodeRaw?.default_value === "string"
      ? countryCodeRaw.default_value.trim()
      : def.fields.country_code.default_value;
  const countryCodeBase = resolveField(countryCodeRaw, def.fields.country_code);
  const countryCode: CountryCodeFieldConfig = {
    ...countryCodeBase,
    required: countryCodeDefault === "" && countryCodeBase.required,
    default_value: countryCodeDefault,
  };

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
      name: { ...name, visible: true, required: true },
      email: { ...email, visible: true, required: true },
      phone,
      country_code: countryCode,
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
