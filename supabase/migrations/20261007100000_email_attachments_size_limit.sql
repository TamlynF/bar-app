-- email-attachments is private: signed-in staff can read (through signed
-- links) and nothing else has a policy - every write goes through the service
-- role. The one thing missing was a size limit on the bucket itself.
--
-- 40 MB matches the largest email Resend accepts inbound, and covers every
-- limit the app sets on its own sends (9 MB replies, 10 MB template files).
-- An inbound file over it fails to store, is logged and skipped; the email
-- itself is still saved. File types stay open - customers reply with all sorts.

update storage.buckets
set file_size_limit = 40 * 1024 * 1024
where id = 'email-attachments';
