export type GroupType = "basic" | "trip" | "household";

export type Group = {
  id: string;
  name: string;
  type: GroupType;
  balance: number;
};

export const MOCK_GROUPS: Group[] = [
  { id: "g1", name: "Family Budget", type: "household", balance: -42.5 },
  { id: "g2", name: "Vacation Planning", type: "trip", balance: 128.0 },
  { id: "g3", name: "Team Lunches", type: "basic", balance: 0 },
];

export function getGroupById(id: string): Group | undefined {
  return MOCK_GROUPS.find((g) => g.id === id);
}

export function addGroup(group: Group) {
  MOCK_GROUPS.push(group);
}
