import type { Actor, Role } from "@kupragao/lms-contracts";

export const testActors = {
  ADMIN: { id: "00000000-0000-4000-8000-000000000001", displayName: "Dev Admin", role: "ADMIN" },
  INSTRUCTOR: { id: "00000000-0000-4000-8000-000000000002", displayName: "Dev Instructor", role: "INSTRUCTOR" },
  STUDENT: { id: "00000000-0000-4000-8000-000000000003", displayName: "Dev Student", role: "STUDENT" },
} as const satisfies Record<Role, Actor>;

export function testActor(value: string | undefined): Actor | null {
  if (value === "ADMIN" || value === "INSTRUCTOR" || value === "STUDENT") return testActors[value];
  return null;
}
