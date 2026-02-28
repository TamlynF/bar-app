import { createClient } from "@/lib/supabase/server";
import BookingItem from '@/components/booking-item'

interface EventType {
    category?: string;
    sub_type?: string;
}

interface EventRow {
    event_date?: string;      // aliased from date
    event_title?: string;     // aliased from title
    description?: string;
    event_types_id?: string;
    event_types?: EventType[];
}

interface ContactRow {
    full_name?: string;      // aliased from date
    email?: string;     // aliased from title
    country_code?: string;
    phone_no?: string;
}

interface RawBooking {
    booking_id: string;
    event_id?: string;
    group_name?: string;
    team_id?: string;
    contact_id?: string;
    group_size?: number;
    paid_amount?: number;
    status?: string;
    special_requests?: string;
    booking_created_at?: string;
  contacts?: ContactRow[];  
  events?: EventRow[];
}

export default async function BookingList() {
    const supabase = await createClient();
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          booking_id: id,
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
            phone_no,
          ),
          events(
            event_date: date,
            event_title: title,
            description,
            event_types_id,
            event_types(
              category: type,
              sub_type,
            ),
          ),
        `)
        .order('booking_id', { ascending: true });
    
    console.log(bookings)

    if (error || !bookings) {
        return <div>Failed to load bookings</div>
    }
    
    const allowedStatuses = ['confirmed','pending','waitlisted','cancelled'] as const;
    type Status = typeof allowedStatuses[number];

    return (
       <div className="space-y-8">
            <section className="space-y-4">
            {bookings.map((booking: RawBooking) => {
                 const eventDate = booking.events?.[0]?.event_date || booking.booking_created_at;
                const teamSize = booking.group_size ?? 0;
                const status: Status = allowedStatuses.includes(booking.status as Status)
                     ? booking.status as Status
                    : 'confirmed';
                
                 return (
                   <BookingItem 
                     key={booking.booking_id}
                     id={booking.booking_id}
                     teamName={booking.group_name ?? ""}
                     date={eventDate}
                     amount={teamSize * 2}
                     status={status}
                   />
                 )
             })}
            </section>
        </div>
    )

}