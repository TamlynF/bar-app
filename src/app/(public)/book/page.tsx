import React from 'react'
import BookingForm from "../_components/booking-form"; // Note: Adjust this import if your component is not the default export
import { Calendar, Clock, MapPin, Users, Beer } from "lucide-react";

export const metadata = {
  title: 'Book a Quiz | Bar App',
  description: 'Secure your spot for our next quiz night.',
};

export default async function QuizBookingPage() {

  return (
    <main className="min-h-dvh w-full bg-[#26300D] text-slate-900 flex items-center justify-center py-12 px-4 sm:p-6 md:p-8 lg:p-12">
      <div className="w-full max-w-6xl bg-[#26300D] rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col transition-all duration-300">

        {/* Header Section */}
        <div className="max-w-2xl mx-auto text-center mb-4">
          <div className="inline-flex items-center justify-center p-3 bg-amber-100 rounded-full mb-4">
            <Beer className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Don Fenticas Quiz Night
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8 lg:gap-12">

          {/* Left Column: Event Details */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Event Details</h3>

              <div className="space-y-5">
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-amber-500 mt-0.5 mr-4" />
                  <div>
                    <p className="font-medium text-slate-900">Every Thursday</p>
                    <p className="text-sm text-slate-500">Next quiz is coming up soon!</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Clock className="w-5 h-5 text-amber-500 mt-0.5 mr-4" />
                  <div>
                    <p className="font-medium text-slate-900">8:00 PM Start</p>
                    <p className="text-sm text-slate-500">Arrive by 7:30 PM to grab drinks and seats.</p>
                  </div>
                </div>

                {/* <div className="flex items-start">
                  <Users className="w-5 h-5 text-amber-500 mt-0.5 mr-4" />
                  <div>
                    <p className="font-medium text-slate-900">Max 6 per team</p>
                    <p className="text-sm text-slate-500">£2 entry fee per person (cash only).</p>
                  </div>
                </div> */}

                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-amber-500 mt-0.5 mr-4" />
                  <div>
                    <p className="font-medium text-slate-900">Don Fenticas</p>
                    <p className="text-sm text-slate-500">Regent Street, Hinckley, LE10 0BB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: The Booking Form (Client Component) */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xl">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Reserve Your Table</h3>
              <p className="text-slate-500 mb-8">Lock in your team before we sell out.</p>

              {/* This is where your existing Booking Form component gets injected!
              Because it handles user typing (state), it acts as the "Client" piece.
            */}
              <BookingForm />

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
