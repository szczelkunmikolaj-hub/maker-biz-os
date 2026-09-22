import type { PaymentStatus } from "@/types";

interface Props {
  status: PaymentStatus;
  balance?: number;
  currency?: string;
}

export function PaymentBadge({ status, balance = 0, currency = '€' }: Props) {
  if (status === 'paid') {
    return (
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
        style={{ background: 'color-mix(in srgb, var(--pay-paid) 12%, transparent)', color: 'var(--pay-paid)' }}
      >
        Paid
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
        style={{ background: 'color-mix(in srgb, var(--pay-partial) 12%, transparent)', color: 'var(--pay-partial)' }}
      >
        Partially paid · {currency}{balance.toFixed(0)} left
      </span>
    );
  }
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={{ background: 'color-mix(in srgb, var(--pay-unpaid) 12%, transparent)', color: 'var(--pay-unpaid)' }}
    >
      Unpaid
    </span>
  );
}
