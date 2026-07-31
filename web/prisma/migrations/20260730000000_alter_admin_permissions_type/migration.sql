CREATE OR REPLACE FUNCTION json_to_text_array(j jsonb) RETURNS text[] AS $$
  SELECT ARRAY(SELECT jsonb_array_elements_text(j));
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE "admins" ALTER COLUMN "permissions" DROP DEFAULT;
ALTER TABLE "admins" ALTER COLUMN "permissions" TYPE TEXT[] USING json_to_text_array(CASE WHEN "permissions" = '' THEN '[]' ELSE "permissions" END::jsonb);
ALTER TABLE "admins" ALTER COLUMN "permissions" SET DEFAULT ARRAY[]::TEXT[];

DROP FUNCTION json_to_text_array;
