BEGIN;

CREATE TYPE "app"."CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

ALTER TABLE "app"."Course"
  ADD COLUMN "level" "app"."CourseLevel",
  ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "priceRegular" INTEGER,
  ADD COLUMN "priceSale" INTEGER;

ALTER TABLE "app"."Course"
  ADD CONSTRAINT "Course_price_regular_positive" CHECK ("priceRegular" IS NULL OR ("priceRegular" > 0 AND "priceRegular" <= 10000000)),
  ADD CONSTRAINT "Course_price_sale_below_regular" CHECK (
    "priceSale" IS NULL OR (
      "priceRegular" IS NOT NULL
      AND "priceSale" > 0
      AND "priceSale" < "priceRegular"
      AND "priceSale" <= 10000000
    )
  );

CREATE TABLE "app"."CourseSlugAlias" (
  "slug" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  CONSTRAINT "CourseSlugAlias_pkey" PRIMARY KEY ("slug")
);

CREATE INDEX "CourseSlugAlias_courseId_idx" ON "app"."CourseSlugAlias"("courseId");

ALTER TABLE "app"."CourseSlugAlias"
  ADD CONSTRAINT "CourseSlugAlias_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "app"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CourseSlugAlias_slug_nonempty" CHECK (length(trim(slug)) > 0);

CREATE TABLE "app"."Category" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "app"."Category"("slug");

ALTER TABLE "app"."Category"
  ADD CONSTRAINT "Category_slug_nonempty" CHECK (length(trim(slug)) > 0);

CREATE TABLE "app"."CategoryTranslation" (
  "id" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "locale" VARCHAR(2) NOT NULL,
  "title" TEXT NOT NULL,
  CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryTranslation_categoryId_locale_key" ON "app"."CategoryTranslation"("categoryId", "locale");

ALTER TABLE "app"."CategoryTranslation"
  ADD CONSTRAINT "CategoryTranslation_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "app"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CategoryTranslation_locale_supported" CHECK (locale IN ('ka', 'en')),
  ADD CONSTRAINT "CategoryTranslation_title_nonempty" CHECK (length(trim(title)) > 0);

CREATE TABLE "app"."CourseCategory" (
  "courseId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  CONSTRAINT "CourseCategory_pkey" PRIMARY KEY ("courseId", "categoryId")
);

CREATE INDEX "CourseCategory_categoryId_idx" ON "app"."CourseCategory"("categoryId");

ALTER TABLE "app"."CourseCategory"
  ADD CONSTRAINT "CourseCategory_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "app"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CourseCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "app"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON TABLE "app"."Category", "app"."CategoryTranslation", "app"."CourseCategory", "app"."CourseSlugAlias"
  FROM PUBLIC, anon, authenticated, betterlife_app;

ALTER TABLE "app"."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."CategoryTranslation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."CourseCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."CourseSlugAlias" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "app"."Category" TO betterlife_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "app"."CategoryTranslation" TO betterlife_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "app"."CourseCategory" TO betterlife_app;
GRANT SELECT, INSERT, DELETE ON TABLE "app"."CourseSlugAlias" TO betterlife_app;

CREATE POLICY runtime_data ON "app"."Category" TO betterlife_app USING (true) WITH CHECK (true);
CREATE POLICY runtime_data ON "app"."CategoryTranslation" TO betterlife_app USING (true) WITH CHECK (true);
CREATE POLICY runtime_data ON "app"."CourseCategory" TO betterlife_app USING (true) WITH CHECK (true);
CREATE POLICY runtime_data ON "app"."CourseSlugAlias" TO betterlife_app USING (true) WITH CHECK (true);

COMMIT;
