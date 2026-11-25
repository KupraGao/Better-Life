import type { CourseDb } from "@kupragao/lms-core";
import { courseDb, runtimeUrl } from "./db";

export const isolatedDatabaseName = "lms_dev_host";

export function rejectUnisolatedDatabase(target: { hostname: string; port: string; database: string }) {
  if (target.hostname !== "127.0.0.1") throw new Error("dev-host database must use the local address");
  if (target.port !== "55432") throw new Error("dev-host database must use the local port");
  if (target.database === "betterlife" || target.database === "postgres") {
    throw new Error("dev-host cannot use the BetterLife database");
  }
  if (target.database !== isolatedDatabaseName) throw new Error("dev-host database name is not isolated");
}

export function courseDbPort(): CourseDb {
  const url = runtimeUrl();
  rejectUnisolatedDatabase({
    hostname: url.hostname,
    port: url.port,
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  });
  return courseDb;
}
