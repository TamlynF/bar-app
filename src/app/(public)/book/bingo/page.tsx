import BingoBookingForm from "./_components/bingo-booking-form";
import Image from "next/image";

export const metadata = {
  title: "Music Bingo | Don Fenticas",
  description: "Book your spot for Music Bingo night at Don Fenticas.",
};

export default function BingoBookingPage() {
  const pricePerPersonPence = parseInt(
    process.env.BINGO_PRICE_PER_PERSON_PENCE ?? "500",
    10
  );

  return (
    <main className="min-h-dvh w-full bg-[#26300D] flex flex-col items-center px-4 py-12 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`
      }} />

      {/* Header */}
      <div className="text-center mb-8 max-w-md w-full">
        <Image
          src="/CompanyName.png"
          alt="Don Fenticas Logo"
          width={260}
          height={70}
          className="w-56 h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)] mx-auto mb-6"
          priority
        />
        <div className="inline-flex items-center gap-2 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-4 py-1.5 mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]">
            Music Bingo
          </span>
        </div>
        <h1 className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tight leading-none mb-2">
          Book Your Spot
        </h1>
        <p className="text-stone-400 text-sm font-medium leading-relaxed">
          Fill in your details below. Payment is required to confirm your booking.
        </p>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-md bg-[#F7F4EA] rounded-3xl p-6 shadow-2xl shadow-black/40">
        <BingoBookingForm pricePerPersonPence={pricePerPersonPence} />
      </div>

      {/* Footer */}
      <div className="mt-10 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 text-stone-800">
          <div className="h-px w-6 bg-stone-800/50" />
          <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
          <div className="h-px w-6 bg-stone-800/50" />
        </div>
        <p className="text-[8px] text-stone-700 uppercase tracking-widest font-bold opacity-40">
          Licensed Venue · Please Drink Responsibly
        </p>
      </div>
    </main>
  );
}
