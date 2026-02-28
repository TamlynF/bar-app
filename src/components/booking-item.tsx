import { useFormatCurrency } from "@/hooks/use-format-currency"
import { HandCoins, Wallet, Landmark, PiggyBank, Pencil, type LucideIcon } from 'lucide-react'
import Link from "next/link"

export default function BookingItem({
  key, id, teamName, date, amount, status = 'confirmed'
}: {
  key: string;
        id: string;
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

  return (<div className="w-full flex items-center">
    <div className="flex items-center mr-4 grow">
      <IconComponent className={`${colors} mr-2 w-4 h-4 hidden sm:block`} />
      <span>{teamName}</span>
    </div>

    <div className="min-w-37.5 items-center hidden md:flex">
      {date && <div className="rounded-md text-xs bg-gray-700 dark:bg-gray-100 text-gray-100 dark:text-black px-2 py-0.5">{date}</div>}
    </div>

    <div className="min-w-17.5 text-right">{formattedAmount}</div>

    {/* <div className="min-w-25 flex justify-end">
      <Link href={`/dashboard/transaction/${id}/edit`} className={`${variants['ghost']} ${sizes['xs']}`}>
        <Pencil className="w-4 h-4" />
      </Link>
      <TransactionItemRemoveButton id={id} onRemoved={onRemoved} />
    </div> */}
  </div>)
}