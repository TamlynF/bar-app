import { createClient } from "@/lib/supabase/server";
import BookingItem from '@/components/booking-item'

export default async function BookingList() {
    const supabase = createClient();
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, events(date, title, description)')
        .order('created_at', { ascending: true })
    
    return (
        <div className="space-y-8">
            <section className="space-y-4">
              {bookings.map(booking => <div key={booking.id}>
                <BookingItem {...booking} />
              </div>)}
            </section>
        </div>
    )

}