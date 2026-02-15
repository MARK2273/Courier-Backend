-- Migration to remove unused routing columns from shipments table
ALTER TABLE shipments
DROP COLUMN IF EXISTS final_destination,
DROP COLUMN IF EXISTS origin_country,
DROP COLUMN IF EXISTS final_country;
