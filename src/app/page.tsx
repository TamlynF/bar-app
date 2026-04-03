import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default function HomePage() {
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Redirecting...</h1>
      <Button variant="default" onClick={() => redirect("/login")} className="ml-4">
        Login
      </Button>
      <Button variant="secondary" onClick={() => redirect("/bookings")} className="ml-4">
        Bookings
      </Button>
    </div>
  )
}
