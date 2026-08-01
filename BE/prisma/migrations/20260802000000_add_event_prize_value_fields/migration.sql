ALTER TABLE "event_prizes"
ADD COLUMN "amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "placement" INTEGER,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'VND';

UPDATE "event_prizes"
SET "placement" = CASE
  WHEN "name" ~* '(first|1st|champion)' THEN 1
  WHEN "name" ~* '(second|2nd|runner-up|runner up)' THEN 2
  WHEN "name" ~* '(third|3rd)' THEN 3
  ELSE NULL
END;

UPDATE "event_prizes"
SET
  "amount" = REPLACE(SUBSTRING("description" FROM '\$([0-9][0-9,]*)'), ',', '')::INTEGER,
  "currency" = 'USD'
WHERE "description" ~ '\$[0-9]';
