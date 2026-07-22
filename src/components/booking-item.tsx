import { useFormatCurrency } from "@/hooks/use-format-currency"
import { HandCoins, Wallet, Landmark, PiggyBank, type LucideIcon } from 'lucide-react'

export default function BookingItem({
  teamName, date, amount, status = 'confirmed'
}: {
  status?: 'confirmed' | 'pending' | 'waitlisted' | 'cancelled';
  teamName?: string;
  date?: string;
  amount: number;
}) {
  const statusMap: Record<'confirmed'|'pending'|'waitlisted'|'cancelled', { icon: LucideIcon; colors: string }> = {
    'confirmed': {
      icon: HandCoins,
      colors: 'text-green-500 dark:text-green-400'
    },
    'pending': {
      icon: Wallet,
      colors: 'text-red-500 dark:text-red-400'
    },
    'waitlisted': {
      icon: PiggyBank,
      colors: 'text-indigo-500 dark:text-indigo-400'
    },
    'cancelled': {
      icon: Landmark,
      colors: 'text-yellow-500 dark:text-yellow-400'
    }
  }
  const { icon: IconComponent, colors } = statusMap[status]
    const formattedAmount = useFormatCurrency(amount)

  return (<div className="flex w-full items-center">
    <div className="mr-4 flex grow items-center">
      <IconComponent className={`${colors} mr-2 hidden h-4 w-4 sm:block`} />
      <span>{teamName}</span>
    </div>

    <div className="hidden min-w-37.5 items-center md:flex">
      {date && <div className="rounded-md bg-gray-700 px-2 py-0.5 text-xs text-gray-100 dark:bg-gray-100 dark:text-black">{date}</div>}
    </div>

    <div className="min-w-17.5 text-right">{formattedAmount}</div>

  </div>)
}