export type Payment = {
  id: string;
  date: string;
  name: string;
  paidBy: string;
  amount: number;
};

export const MOCK_PAYMENTS: Record<string, Payment[]> = {
  g1: [
    { id: "p1", date: "2026-04-10", name: "Groceries", paidBy: "Alice", amount: 52.3 },
    { id: "p2", date: "2026-04-12", name: "Electricity", paidBy: "Bob", amount: 89.9 },
    { id: "p3", date: "2026-04-15", name: "Internet", paidBy: "Alice", amount: 35.0 },
  ],
  g2: [
    { id: "p4", date: "2026-04-02", name: "Flight tickets", paidBy: "Charlie", amount: 420.0 },
    { id: "p5", date: "2026-04-06", name: "Hotel", paidBy: "Diana", amount: 310.5 },
    { id: "p6", date: "2026-04-08", name: "Dinner", paidBy: "Charlie", amount: 64.0 },
  ],
  g3: [
    { id: "p7", date: "2026-04-11", name: "Pizza Friday", paidBy: "Ethan", amount: 48.0 },
  ],
};

export function getPaymentsForGroup(groupId: string): Payment[] {
  return MOCK_PAYMENTS[groupId] ?? [];
}
