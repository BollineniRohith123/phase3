-- Update tier names to new naming convention
UPDATE ticket_tiers SET name = 'Silver' WHERE id = '5d0ad957-87f8-4649-a24e-5b5ef706ea3e';
UPDATE ticket_tiers SET name = 'Gold' WHERE id = '7c1b0788-48ed-4677-bf66-6c9ee0252458';
UPDATE ticket_tiers SET name = 'Diamond' WHERE id = '91319a46-7433-4671-a97b-61b46f3c5908';
UPDATE ticket_tiers SET name = 'Fanpit' WHERE id = 'be148d6b-18bb-49fc-ad12-5fff721b845e';
UPDATE ticket_tiers SET name = 'VIP' WHERE id = '318561e2-42a2-48b7-8030-5cafed5a960d';

-- Delete Tier 4 (₹1899) completely from the database
DELETE FROM ticket_tiers WHERE id = 'e2b9bb40-1373-4f42-815e-667c5d025cdf';