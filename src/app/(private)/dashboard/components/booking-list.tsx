import { createClient } from "@/lib/supabase/server";
import BookingItem from '@/components/booking-item'

export interface EventType {
    category?: string;
    sub_type?: string;
}

export interface EventRow {
    event_date?: string;      // aliased from date
    event_title?: string;     // aliased from title
    description?: string;
    event_types_id?: string;
    event_types?: EventType[];
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
  contacts?: ContactRow[];  
  events?: EventRow | EventRow[];
}

type GroupedBookings = Record<string, RawBooking[]>;

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
    
    console.log(JSON.stringify(bookings, null, 2));

  if (error) {
    return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error loading bookings: {error.message}</div>;
  }

  if (!bookings || bookings.length === 0) {
    return <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">No bookings found.</div>;
  }
    
    // 1. Group bookings by event_date
  const groupedBookings: GroupedBookings = bookings.reduce<GroupedBookings>((acc, booking: RawBooking) => {
    // Safely extract the date (handling both Object and Array responses from Supabase)
    const events = booking.events;
    const eventDate = Array.isArray(events) 
        ? events[0]?.event_date 
        : events?.event_date;
        
    const dateKey = eventDate || 'Unknown Date';
    
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(booking);
    
    return acc;
  }, {} as GroupedBookings);

    // 2. Sort dates chronologically
  const sortedDates = Object.keys(groupedBookings).sort((a, b) => {
    if (a === 'Unknown Date') return 1;
    if (b === 'Unknown Date') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  // 3. Status color mapping
  const getStatusColor = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'confirmed') return 'bg-green-100 text-green-800 border-green-200';
    if (s === 'cancelled') return 'bg-red-100 text-red-800 border-red-200';
    // 'waitlisted' or any other status gets orange so it's easily noticeable
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  // Helper for nice date formatting
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Helpers to safely extract relations
    const getEvent = (b: RawBooking) => Array.isArray(b.events) ? b.events[0] : b.events;
    const getContact = (b: RawBooking) => Array.isArray(b.contacts) ? b.contacts[0] : b.contacts;
    const getEventType = (e?: EventRow) => e ? (Array.isArray(e.event_types) ? e.event_types[0] : e.event_types) : null;

    const allowedStatuses = ['confirmed','pending','waitlisted','cancelled'] as const;
    type Status = typeof allowedStatuses[number];

      return (
    <div className="space-y-10 py-6">
      {sortedDates.map(dateKey => {
        const dateBookings = groupedBookings[dateKey];
        
        return (
          <section key={dateKey} className="space-y-4">
            {/* Group Header */}
            <div className="flex items-end gap-3 border-b border-gray-200 pb-2">
              <h3 className="text-2xl font-bold text-gray-800">
                {dateKey !== 'Unknown Date' ? formatDate(dateKey) : 'No Date Set'}
              </h3>
              <span className="text-sm font-medium text-gray-500 mb-1 bg-gray-100 px-2 py-0.5 rounded-full">
                {dateBookings.length} {dateBookings.length === 1 ? 'booking' : 'bookings'}
              </span>
            </div>
            
            {/* Grid of Bookings */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {dateBookings.map((booking) => {
                const event = getEvent(booking);
                const contact = getContact(booking);
                const eventType = getEventType(event);

                return (
                  <div 
                    key={booking.id} 
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                  >
                    {/* Card Header */}
                    <div className="p-4 border-b border-gray-100 bg-slate-50 flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 leading-tight">
                          {event?.event_title || 'Unnamed Event'}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                          {eventType?.category || 'No Category'} 
                          {eventType?.sub_type ? <span className="text-gray-400 mx-1">•</span> : ''} 
                          {eventType?.sub_type || ''}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 text-xs font-bold tracking-wide border rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                    
                    {/* Card Body */}
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs mb-1 font-medium">Group Name</p>
                          <p className="font-semibold text-gray-900 truncate" title={booking.group_name}>
                            {booking.group_name || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs mb-1 font-medium">Contact Name</p>
                          <p className="font-semibold text-gray-900 truncate" title={contact?.full_name}>
                            {contact?.full_name || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs mb-1 font-medium">Group Size</p>
                          <p className="font-semibold text-gray-900">
                            {booking.group_size} {booking.group_size === 1 ? 'person' : 'people'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs mb-1 font-medium">Booked On</p>
                          <p className="font-semibold text-gray-900">
                            {booking.booking_created_at ? (
                              new Date(booking.booking_created_at).toLocaleDateString('en-GB', {
                                day: '2-digit', month: 'short', year: 'numeric'
                              })
                            ) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );

}