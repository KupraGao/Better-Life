-- Row locks on a previous address use SELECT ... FOR UPDATE, which requires UPDATE.
GRANT UPDATE ON TABLE "app"."CourseSlugAlias" TO betterlife_app;
