import { useMemo } from "react"

export const useFormatCurrency = (amount: number) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(val)

  return useMemo(
    () => formatCurrency(amount),
    [amount]
  )
}