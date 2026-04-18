import { MOCK_FRIENDS } from "@/constants/mock-friends";
import { CURRENT_USER, User } from "@/constants/mock-user";

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

const GROUP_MEMBER_IDS: Record<string, string[]> = {
  g1: [CURRENT_USER.id, "u1", "u2"],
  g2: [CURRENT_USER.id, "u3", "u4", "u5"],
  g3: [CURRENT_USER.id, "u6"],
};

export function getGroupById(id: string): Group | undefined {
  return MOCK_GROUPS.find((g) => g.id === id);
}

export function addGroup(group: Group) {
  MOCK_GROUPS.push(group);
  GROUP_MEMBER_IDS[group.id] = [CURRENT_USER.id];
}

function resolveUserById(userId: string): User | undefined {
  if (userId === CURRENT_USER.id) {
    return CURRENT_USER;
  }
  const friend = MOCK_FRIENDS.find((entry) => entry.id === userId);
  return friend ? { id: friend.id, name: friend.name } : undefined;
}

export function getGroupMemberIds(groupId: string): string[] {
  return GROUP_MEMBER_IDS[groupId] ?? [CURRENT_USER.id];
}

export function getGroupMembers(groupId: string): User[] {
  return getGroupMemberIds(groupId)
    .map((memberId) => resolveUserById(memberId))
    .filter((member): member is User => !!member);
}

export function addMembersToGroup(groupId: string, memberIds: string[]) {
  if (memberIds.length === 0) return;
  const existing = getGroupMemberIds(groupId);
  GROUP_MEMBER_IDS[groupId] = Array.from(new Set([...existing, ...memberIds]));
}
