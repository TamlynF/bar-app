import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#26300D] text-white">
      <h1 className="text-2xl font-bold">Don Fenticas</h1>
      
      <Button variant="default" asChild className="ml-6 bg-[#FDCC4B] text-[#26300D] hover:bg-[#e5b843]">
        <Link href="/login">Staff Login</Link>
      </Button>
      
      <Button variant="secondary" asChild className="ml-4">
        <Link href="/book">Make a Booking</Link>
      </Button>
    </div>
  );
}