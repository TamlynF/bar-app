"use client";

import { useState, useMemo } from 'react';
import { Search, Calendar, Ticket, Tags } from 'lucide-react';


export interface EventType {
  category?: string;
  sub_type?: string;
}

export interface EventRow {
  event_date?: string;      // aliased from date
  event_title?: string;     // aliased from title
  description?: string;
  event_types?: EventType | EventType[];
}

export interface ContactRow {
  full_name?: string;      // aliased from date
  email?: string;     // aliased from title
  country_code?: string;
  phone_no?: string;
}

export interface Booking {
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
  contacts?: ContactRow | ContactRow[];
  events?: EventRow | EventRow[];
}

  // Helpers to safely extract relations
  const getEvent = (b: Booking) => Array.isArray(b.events) ? b.events[0] : b.events;
  const getContact = (b: Booking) => Array.isArray(b.contacts) ? b.contacts[0] : b.contacts;
  const getEventType = (e?: EventRow) => e ? (Array.isArray(e.event_types) ? e.event_types[0] : e.event_types) : null;

// Helper for nice date formatting
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr || dateStr === 'Unknown Date') return 'No Date Set';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};


// 3. Status color mapping
const getStatusColor = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'confirmed') return 'bg-green-100 text-green-800 border-green-200';
  if (s === 'cancelled') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-orange-100 text-orange-800 border-orange-200';
};

// Distinct color themes to apply to different dates
const dateThemes = [
  { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { bg: 'bg-rose-50', text: 'text-rose-900', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-900', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
];

export default function BookingListClient1({ initialBookings }: { initialBookings: Booking[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter bookings based on search query
  const filteredBookings = useMemo<Booking[]>(() => {
    if (!searchQuery.trim()) return initialBookings;
    
    return initialBookings.filter((booking) => {
      const query = searchQuery.toLowerCase();
      const event = getEvent(booking);
      const eventType = getEventType(event);
      
      const searchString = `
        ${event?.event_date || ''}
        ${event?.event_title || ''}
        ${eventType?.category || ''}
        ${eventType?.sub_type || ''}
      `.toLowerCase();
      
      return searchString.includes(query);
    });
  }, [initialBookings, searchQuery]);

  // 2. Group the filtered bookings by event details
  const groupedBookings = useMemo<Record<string, Booking[]>>(() => {
    return filteredBookings.reduce<Record<string, Booking[]>>((acc, booking) => {
      const event = getEvent(booking);
      const eventType = getEventType(event);
      
      const date = event?.event_date || 'Unknown Date';
      const title = event?.event_title || 'Unnamed Event';
      const cat = eventType?.category || 'No Category';
      const sub = eventType?.sub_type || '';
      
      const eventKey = JSON.stringify({ date, title, cat, sub });
      
      if (!acc[eventKey]) acc[eventKey] = [];
      acc[eventKey].push(booking);
      
      return acc;
    }, {} as Record<string, Booking[]>);
  }, [filteredBookings]);

  // 3. Sort keys chronologically
  const sortedEventKeys = Object.keys(groupedBookings).sort((a, b) => {
    const dateA = JSON.parse(a).date;
    const dateB = JSON.parse(b).date;
    if (dateA === 'Unknown Date') return 1;
    if (dateB === 'Unknown Date') return -1;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  // 4. Assign a consistent color theme to each unique date
  const dateColorMap = useMemo(() => {
    const map = new Map<string, typeof dateThemes[0]>();
    let colorIndex = 0;
    
    sortedEventKeys.forEach(key => {
      const { date } = JSON.parse(key);
      if (!map.has(date)) {
        map.set(date, dateThemes[colorIndex % dateThemes.length]);
        colorIndex++;
      }
    });
    return map;
  }, [sortedEventKeys]);

  return (
    <div className="space-y-6 py-6">
      {/* Filter Header */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96 text-gray-500 focus-within:text-blue-600">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 outline-none"
            placeholder="Filter by date, category, or sub-type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500 font-medium">
          Showing {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'}
        </div>
      </div>

      {sortedEventKeys.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl">
          <p className="text-gray-500 text-lg">No bookings match your filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedEventKeys.map(eventKey => {
            const eventBookings = groupedBookings[eventKey];
            const { date, title, cat, sub } = JSON.parse(eventKey);
            const theme = dateColorMap.get(date) || dateThemes[0];

            return (
              <div 
                key={eventKey} 
                className={`bg-white rounded-xl border-2 ${theme.border} shadow-sm overflow-hidden transition-all hover:shadow-md`}
              >
                {/* Unified Event Header (All details on one line) */}
                <div className={`p-4 border-b ${theme.border} ${theme.bg} flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4`}>
                  <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-base font-semibold ${theme.text}`}>
                    
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Calendar className="w-5 h-5 opacity-70" />
                      {formatDate(date)}
                    </span>
                    
                    <span className="text-black/10 hidden sm:inline">|</span>
                    
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Ticket className="w-5 h-5 opacity-70" />
                      {title}
                    </span>
                    
                    <span className="text-black/10 hidden sm:inline">|</span>
                    
                    <span className={`flex items-center gap-2 whitespace-nowrap px-2.5 py-1 rounded-md text-xs sm:text-sm uppercase tracking-wider border ${theme.badge}`}>
                      <Tags className="w-4 h-4 opacity-70" />
                      {cat} {sub ? <span className="opacity-50 mx-1">•</span> : ''} {sub}
                    </span>

                  </div>

                  <span className={`inline-flex shrink-0 items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-white/70 shadow-sm border ${theme.border} ${theme.text}`}>
                    {eventBookings.length} {eventBookings.length === 1 ? 'Booking' : 'Bookings'}
                  </span>
                </div>
                
                {/* Bookings Table Line Items */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-4">Group Name</th>
                        <th className="px-5 py-4">Full Name</th>
                        <th className="px-5 py-4">Size</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Booked On</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {eventBookings.map((booking) => {
                        const contact = getContact(booking);

                        return (
                          <tr key={booking.id} className="hover:bg-gray-50 transition-colors group">
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
                              {formatDate(booking.booking_created_at)}
                            </td>
                            <td className="px-5 py-4 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                className="px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none"
                                aria-label={`Edit booking for ${booking.group_name}`}
                              >
                                Edit
                              </button>
                              <button 
                                className="px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-md transition-colors focus:outline-none"
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
      )}
    </div>
  );
}