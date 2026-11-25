import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/** The host generates this client. Learning functions receive it; they do not open the connection. */
export type LearningClient = PrismaClient;
export type LearningStore = Prisma.TransactionClient;
export type CourseWhere = Prisma.CourseWhereInput;
export type CourseSelect = Prisma.CourseSelect;
export type LearningItemWhere = Prisma.LearningItemWhereInput;
export type CoursePayload<T extends Prisma.CourseDefaultArgs> = Prisma.CourseGetPayload<T>;
