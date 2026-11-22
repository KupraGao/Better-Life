BEGIN;

ALTER TABLE app."Course" ADD CONSTRAINT "Course_slug_nonempty" CHECK (length(trim(slug)) > 0);
ALTER TABLE app."CourseTranslation" ADD CONSTRAINT "CourseTranslation_locale_supported" CHECK (locale IN ('ka', 'en'));
ALTER TABLE app."ItemTranslation" ADD CONSTRAINT "ItemTranslation_locale_supported" CHECK (locale IN ('ka', 'en'));
ALTER TABLE app."Module" ADD CONSTRAINT "Module_position_nonnegative" CHECK (position >= 0),
  ADD CONSTRAINT "Module_titles_object" CHECK (jsonb_typeof(titles) = 'object');
ALTER TABLE app."LearningItem" ADD CONSTRAINT "LearningItem_position_nonnegative" CHECK (position >= 0),
  ADD CONSTRAINT "LearningItem_delay_nonnegative" CHECK ("delayDays" >= 0);
ALTER TABLE app."Progress" ADD CONSTRAINT "Progress_position_nonnegative" CHECK ("positionSec" >= 0);
ALTER TABLE app."LessonAsset" ADD CONSTRAINT "LessonAsset_actual_bytes"
  CHECK ("sizeBytes" > 0 AND "sizeBytes" = octet_length(data));

-- The application is server-only. Browser roles never receive application-schema privileges.
REVOKE ALL ON SCHEMA app FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC, anon, authenticated, betterlife_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app TO betterlife_app;
GRANT SELECT, INSERT ON app."AppUser" TO betterlife_app;
GRANT UPDATE ("displayName") ON app."AppUser" TO betterlife_app;
ALTER TABLE app."AppUser" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runtime_read_profiles" ON app."AppUser" FOR SELECT TO betterlife_app USING (true);
CREATE POLICY "runtime_register_student" ON app."AppUser" FOR INSERT TO betterlife_app WITH CHECK (role = 'STUDENT');
CREATE POLICY "runtime_update_profile" ON app."AppUser" FOR UPDATE TO betterlife_app USING (true) WITH CHECK (true);

-- Session, role and resource-level decisions happen in the server entry points.
-- Policies target only this non-owner, non-BYPASSRLS connection role.
DO $$
DECLARE rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['Course','CourseTranslation','CourseInstructor','Module','LearningItem',
    'ItemTranslation','LessonAsset','Enrollment','Progress'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON app.%I TO betterlife_app', rel);
    EXECUTE format('CREATE POLICY runtime_data ON app.%I TO betterlife_app USING (true) WITH CHECK (true)', rel);
  END LOOP;
END $$;
GRANT DELETE ON app."CourseInstructor", app."LessonAsset", app."Progress" TO betterlife_app;

COMMIT;
