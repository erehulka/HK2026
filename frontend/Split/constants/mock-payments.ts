export type SplitMethod = "equal" | "percentage" | "exact";

export type Payment = {
  id: string;
  date: string;
  name: string;
  paidBy: string;
  amount: number;
  paidById?: string;
  owesIds?: string[];
  splitMethod?: SplitMethod;
  splitValues?: Record<string, string>;
};

export const MOCK_PAYMENTS: Record<string, Payment[]> = {
  g1: [
    {
      id: "p1",
      date: "2026-04-10",
      name: "Groceries",
      paidBy: "Alice",
      amount: 52.3,
    },
    {
      id: "p2",
      date: "2026-04-12",
      name: "Electricity",
      paidBy: "Bob",
      amount: 89.9,
    },
    {
      id: "p3",
      date: "2026-04-15",
      name: "Internet",
      paidBy: "Alice",
      amount: 35.0,
    },
  ],
  g2: [
    {
      id: "p4",
      date: "2026-04-02",
      name: "Flight tickets",
      paidBy: "Charlie",
      amount: 420.0,
    },
    {
      id: "p5",
      date: "2026-04-06",
      name: "Hotel",
      paidBy: "Diana",
      amount: 310.5,
    },
    {
      id: "p6",
      date: "2026-04-08",
      name: "Dinner",
      paidBy: "Charlie",
      amount: 64.0,
    },
  ],
  g3: [
    {
      id: "p7",
      date: "2026-04-11",
      name: "Pizza Friday",
      paidBy: "Ethan",
      amount: 48.0,
    },
  ],
};

export function getPaymentsForGroup(groupId: string): Payment[] {
  return MOCK_PAYMENTS[groupId] ?? [];
}

export function getPaymentById(
  groupId: string,
  paymentId: string
): Payment | undefined {
  return MOCK_PAYMENTS[groupId]?.find((p) => p.id === paymentId);
}

export function addPayment(groupId: string, payment: Payment) {
  if (!MOCK_PAYMENTS[groupId]) {
    MOCK_PAYMENTS[groupId] = [];
  }
  MOCK_PAYMENTS[groupId].push(payment);
}

export function computeUserShare(
  payment: Payment,
  userId: string,
  fallbackMemberIds: string[]
): number {
  const owesIds = payment.owesIds ?? fallbackMemberIds;
  if (!owesIds.includes(userId)) return 0;

  const method = payment.splitMethod ?? "equal";
  if (method === "equal") {
    return owesIds.length > 0 ? payment.amount / owesIds.length : 0;
  }
  if (method === "percentage") {
    const pct = parseFloat(payment.splitValues?.[userId] ?? "0");
    return isNaN(pct) ? 0 : (payment.amount * pct) / 100;
  }
  const exact = parseFloat(payment.splitValues?.[userId] ?? "0");
  return isNaN(exact) ? 0 : exact;
}

export function computeUserBalanceEffect(
  payment: Payment,
  userId: string,
  userName: string,
  fallbackMemberIds: string[]
): number {
  const youPaid =
    payment.paidById === userId ||
    (payment.paidById === undefined && payment.paidBy === userName);
  const share = computeUserShare(payment, userId, fallbackMemberIds);
  return youPaid ? payment.amount - share : -share;
}

export function updatePayment(
  groupId: string,
  paymentId: string,
  patch: Partial<Payment>
) {
  const list = MOCK_PAYMENTS[groupId];
  if (!list) return;
  const idx = list.findIndex((p) => p.id === paymentId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch };
}
