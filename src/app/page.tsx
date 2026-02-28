"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import BookingForm from "./(public)/_components/booking-form";


export default function HomePage() {
  const [openAuthSheet, setOpenAuthSheet] = React.useState(false);

  return (
    <div className="flex flex-col">
      <div className="bg-primary px-20 py-5 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">S . H . E . Y</h1>
        <Button variant={"outline"} onClick={() => setOpenAuthSheet(true)}>
          Login
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 items-center h-[85vh] px-20">
        <div className="col-span-1 mt-20 lg:mt-0">
          <div className="flex flex-col gap-3">
            <h1 className="text-lg font-bold text-primary">
              Discover & Book Your Dream Vacation
            </h1>
            <p className="text-sm text-gray-700 font-semibold">
              Welcome to Shey Travel Packages — your go-to platform for
              discovering unforgettable travel experiences. Browse exclusive
              travel packages, book hassle-free getaways, and explore curated
              destinations from around the world.
            </p>

            <Button className="w-max">Get started</Button>
          </div>
        </div>
      </div>

      {openAuthSheet && (
        <Sheet open={openAuthSheet} onOpenChange={setOpenAuthSheet}>
          <SheetContent className="lg:min-w-125">
            <SheetHeader>
              <SheetTitle></SheetTitle>
            </SheetHeader>
            <BookingForm />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}