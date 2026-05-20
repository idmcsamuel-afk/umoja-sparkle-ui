
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'zcreator-videos',
  'zcreator-videos',
  true,
  524288000,
  ARRAY['video/mp4','video/webm','image/jpeg','image/png']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "zcreator videos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'zcreator-videos');

CREATE POLICY "zcreator videos auth upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'zcreator-videos');

CREATE POLICY "zcreator videos owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'zcreator-videos' AND owner = auth.uid());

CREATE POLICY "zcreator videos owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'zcreator-videos' AND owner = auth.uid());
