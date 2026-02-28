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

type GroupedBookings = Record<string, Record<string, RawBooking[]>>;

const formatBookingDate = (dateString: string | undefined): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

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

  // Helpers to safely extract relations
  const getEvent = (b: RawBooking) => Array.isArray(b.events) ? b.events[0] : b.events;
  const getContact = (b: RawBooking) => Array.isArray(b.contacts) ? b.contacts[0] : b.contacts;
  const getEventType = (e?: EventRow) => e ? (Array.isArray(e.event_types) ? e.event_types[0] : e.event_types) : null;


  // 1. Group bookings by event_date
  /*   const groupedBookings: GroupedBookings = bookings.reduce<GroupedBookings>((acc, booking: RawBooking) => {
      // Safely extract the date (handling both Object and Array responses from Supabase)
      const events = booking.events;
      const eventDate = Array.isArray(events) 
          ? events[0]?.event_date 
          : events?.event_date;
          
      const dateKey = eventDate || 'Unknown Date';
      
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(booking);
      
      return acc;
    }, {} as GroupedBookings); */

  // 1. Group bookings by event_date, then by event details (title, category, subtype)
  const groupedBookings: GroupedBookings = bookings.reduce<GroupedBookings>((acc, booking: RawBooking) => {
    const event = getEvent(booking);
    const eventType = getEventType(event);

    const eventDate = event?.event_date || 'Unknown Date';

    // Create a robust composite key for the sub-grouping using JSON
    const title = event?.event_title || 'Unnamed Event';
    const cat = eventType?.category || 'No Category';
    const sub = eventType?.sub_type || '';
    const eventKey = JSON.stringify({ title, cat, sub });

    if (!acc[eventDate]) acc[eventDate] = {};
    if (!acc[eventDate][eventKey]) acc[eventDate][eventKey] = [];

    acc[eventDate][eventKey].push(booking);

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



  /*  const allowedStatuses = ['confirmed','pending','waitlisted','cancelled'] as const;
   type Status = typeof allowedStatuses[number];
*/
  return (
    <div className="space-y-12 py-6">
      {sortedDates.map(dateKey => {
        const dateGroups = groupedBookings[dateKey];
        const eventKeys = Object.keys(dateGroups);

        return (
          <section key={dateKey} className="space-y-6">
            {/* Date Header */}
            <div className="border-b-2 border-gray-200 pb-2">
              <h2 className="text-2xl font-bold text-gray-900">
                {dateKey !== 'Unknown Date' ? formatDate(dateKey) : 'No Date Set'}
              </h2>
            </div>

            <div className="space-y-8">
              {eventKeys.map(eventKey => {
                const eventBookings = dateGroups[eventKey];
                const { title, cat, sub } = JSON.parse(eventKey);

                return (
                  <div
                    key={eventKey}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    {/* Event & Category Header */}
                    <div className="bg-slate-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-0.5">
                          {cat} {sub ? <span className="mx-1.5 text-gray-300">•</span> : ''} {sub}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center px-3 py-1 rounded-full text-sm font-medium bg-white border border-gray-200 shadow-sm text-gray-600">
                        {eventBookings.length} {eventBookings.length === 1 ? 'Booking' : 'Bookings'}
                      </span>
                    </div>

                    {/* Bookings Table Line Items */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                          <tr>
                            <th className="px-5 py-3.5">Group Name</th>
                            <th className="px-5 py-3.5">Full Name</th>
                            <th className="px-5 py-3.5">Size</th>
                            <th className="px-5 py-3.5">Status</th>
                            <th className="px-5 py-3.5">Booked On</th>
                            <th className="px-5 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {eventBookings.map((booking) => {
                            const contact = getContact(booking);

                            return (
                              <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-4 font-semibold text-gray-900">
                                  {booking.group_name || '—'}
                                </td>
                                <td className="px-5 py-4 text-gray-600">
                                  {contact?.full_name || '—'}
                                </td>
                                <td className="px-5 py-4 text-gray-600 font-medium">
                                  {booking.group_size}
                                </td>
                                <td className="px-5 py-4">
                                  <span className={`px-2.5 py-1 text-xs font-bold tracking-wide border rounded-full ${getStatusColor(booking.status)}`}>
                                    {booking.status?.toUpperCase() || 'UNKNOWN'}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-gray-500">
                                  {formatBookingDate(booking.booking_created_at)}
                                </td>
                                <td className="px-5 py-4 text-right space-x-4">
                                  <button
                                    className="text-blue-600 hover:text-blue-800 font-semibold transition-colors focus:outline-none"
                                    aria-label={`Edit booking for ${booking.group_name}`}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="text-red-600 hover:text-red-800 font-semibold transition-colors focus:outline-none"
                                    aria-label={`Delete booking for ${booking.group_name}`}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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