-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateEnum
CREATE TYPE "app"."Role" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "app"."ItemKind" AS ENUM ('LESSON', 'QUIZ', 'ASSIGNMENT');

-- CreateEnum
CREATE TYPE "app"."LessonAssetKind" AS ENUM ('IMAGE', 'ATTACHMENT');

-- CreateTable
CREATE TABLE "app"."AppUser" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "app"."Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Course" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "freeEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "strictMode" BOOLEAN NOT NULL DEFAULT false,
    "coverImage" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."CourseTranslation" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "title" TEXT NOT NULL,
    "description" JSONB NOT NULL,

    CONSTRAINT "CourseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."CourseInstructor" (
    "courseId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "CourseInstructor_pkey" PRIMARY KEY ("courseId","userId")
);

-- CreateTable
CREATE TABLE "app"."Module" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "titles" JSONB NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."LearningItem" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "kind" "app"."ItemKind" NOT NULL DEFAULT 'LESSON',
    "position" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "preview" BOOLEAN NOT NULL DEFAULT false,
    "videoSource" TEXT,
    "videoRef" TEXT,
    "releaseAt" TIMESTAMPTZ(3),
    "delayDays" INTEGER,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "LearningItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ItemTranslation" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,

    CONSTRAINT "ItemTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."LessonAsset" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" "app"."LessonAssetKind" NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "LessonAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Enrollment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "enrolledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Progress" (
    "userId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "positionSec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "app"."Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CourseTranslation_courseId_locale_key" ON "app"."CourseTranslation"("courseId", "locale");

-- CreateIndex
CREATE INDEX "CourseInstructor_userId_idx" ON "app"."CourseInstructor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_courseId_position_key" ON "app"."Module"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LearningItem_moduleId_position_key" ON "app"."LearningItem"("moduleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ItemTranslation_itemId_locale_key" ON "app"."ItemTranslation"("itemId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "LessonAsset_objectKey_key" ON "app"."LessonAsset"("objectKey");

-- CreateIndex
CREATE INDEX "LessonAsset_itemId_idx" ON "app"."LessonAsset"("itemId");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "app"."Enrollment"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "app"."Enrollment"("userId", "courseId");

-- CreateIndex
CREATE INDEX "Progress_itemId_idx" ON "app"."Progress"("itemId");

-- AddForeignKey
ALTER TABLE "app"."CourseTranslation" ADD CONSTRAINT "CourseTranslation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "app"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."CourseInstructor" ADD CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "app"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."CourseInstructor" ADD CONSTRAINT "CourseInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "app"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."LearningItem" ADD CONSTRAINT "LearningItem_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "app"."Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ItemTranslation" ADD CONSTRAINT "ItemTranslation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "app"."LearningItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."LessonAsset" ADD CONSTRAINT "LessonAsset_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "app"."LearningItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "app"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Progress" ADD CONSTRAINT "Progress_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "app"."LearningItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
