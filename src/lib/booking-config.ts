export type BookingConfig = {
  collect_group_name?: boolean;
  group_name_label?: string;
  collect_phone?: boolean;
  collect_group_size?: boolean;
  collect_special_requests?: boolean;
  min_group_size?: number;
  max_group_size?: number;
  group_size_options?: number[];
  custom_cta_text?: string;
  custom_tagline?: string;
  confirmation_message?: string;
  booking_image_url?: string | null;
};
