import { cookies } from "next/headers";
import { testActors } from "./actors";
import { loadActor } from "./actor-store";

export const devHostActorCookie = "dev_host_actor";
export { loadActor } from "./actor-store";

export async function integrationActor() {
  if (process.env.LMS_DEV_HOST_MODE !== "integration") return null;
  const id = (await cookies()).get(devHostActorCookie)?.value;
  if (!id) return null;
  return loadActor(id);
}

export async function selectTestActor(role: keyof typeof testActors) {
  if (process.env.LMS_DEV_HOST_MODE !== "integration") {
    throw new Error("test actors are available only in the isolated dev host");
  }
  const stored = await loadActor(testActors[role].id);
  if (!stored || stored.role !== role) throw new Error("test actor is not seeded");
  (await cookies()).set(devHostActorCookie, stored.id, {
    httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 60 * 60 * 8,
  });
}
