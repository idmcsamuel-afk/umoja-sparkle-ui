UPDATE storage.buckets
SET allowed_mime_types = ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/ogg','video/mp4','image/jpeg','image/png','image/webp']::text[],
    file_size_limit = 52428800,
    public = true
WHERE id = 'zcreator-videos';