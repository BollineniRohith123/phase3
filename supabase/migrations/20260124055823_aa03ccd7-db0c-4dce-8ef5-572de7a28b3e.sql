-- Rename student_id to partner_id in profiles table
ALTER TABLE public.profiles RENAME COLUMN student_id TO partner_id;

-- Rename student_id to partner_id in sales table
ALTER TABLE public.sales RENAME COLUMN student_id TO partner_id;

-- Rename utr_last4 to transaction_id_last4 in sales table
ALTER TABLE public.sales RENAME COLUMN utr_last4 TO transaction_id_last4;