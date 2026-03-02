import { createClient } from "@/lib/supabase/server";
import BookingListClient from './booking-list-client copy';


export interface EventType {
  category?: string;
  sub_type?: string;
}

export interface EventRow {
  event_date?: string;      // aliased from date
  event_title?: string;     // aliased from title
  description?: string;
  event_types?: EventType;
}

export interface ContactRow {
  full_name?: string;      // aliased from date
  email?: string;     // aliased from title
  country_code?: string;
  phone_no?: string;
}

export interface RawBooking {
  id: string;
  event_id?: string;
  group_name?: string;
  team_id?: string;
  contact_id?: string;
  group_size?: number;
  paid_amount?: number;
  status?: string;
  special_requests?: string;
  booking_created_at?: string;
  contacts?: ContactRow;
  events?: EventRow;
}

export default async function BookingList() {
  const supabase = await createClient();
  const { data: bookings, error } = await supabase
    .from<'bookings', RawBooking>('bookings')
    .select(`
          id,
          event_id,
          group_name,
          team_id,
          contact_id,
          group_size,
          paid_amount,
          status,
          special_requests,
          booking_created_at: created_at,
          contacts(
            full_name,
            email,
            country_code,
            phone_no
          ),
          events(
            event_date: date,
            event_title: title,
            description,
            event_types(
              category: type,
              sub_type
            )
          )
        `)
    .order('created_at', { ascending: true });

  //console.log(JSON.stringify(bookings, null, 2));

  if (error) {
    return <div className="p-4 text-red-500 bg-red-50 rounded-lg border border-red-200">Error loading bookings: {error.message}</div>;
  }

  const typedBookings = (bookings as unknown) as RawBooking[];

  if (!bookings || bookings.length === 0) {
    return (
      <div className="p-12 mt-6 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No bookings found</h3>
        <p>There are currently no bookings in the system.</p>
      </div>
    );
  }

return <BookingListClient initialBookings={typedBookings} />;

}