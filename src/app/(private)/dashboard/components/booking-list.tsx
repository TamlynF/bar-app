import { createClient } from "@/lib/supabase/server";
import BookingItem from '@/components/booking-item'

interface Booking {
    id: string;
    group_name?: string;
    user_name?: string;
    quiz_date: string;
    team_size: number;
    status?: string;
}

export default async function BookingList() {
    const supabase = await createClient();
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, event_id, group_name, team_id, contact_id, group_size, paid_amount, status, special_requests, booking_created_at: created_at, events(event_date: date, event_title: title, description, event_types_id, event_types(category: type, sub_type))')
        .order('booking_created_at', { ascending: true })
    
    console.log(bookings)

    if (error || !bookings) {
        return <div>Failed to load bookings</div>
    }
    
    return (
       <div className="space-y-8">
            <section className="space-y-4">
             {bookings.map((booking: Booking) => (
                 <BookingItem 
                     key={booking.id}
            id={booking.id}
            teamName={booking.group_name || booking.name}
            date={booking.quiz_date}
            amount={booking.team_size * 2}
            status={booking.status || "confirmed"}
          />
        ))}
            </section>
        </div>
    )

}