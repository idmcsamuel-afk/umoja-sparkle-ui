-- 1) Tighten spark_trade_group_brand_investors SELECT policy
DROP POLICY IF EXISTS "View own or co-investor records" ON public.spark_trade_group_brand_investors;

CREATE POLICY "View own investment or brand founder or admin"
ON public.spark_trade_group_brand_investors
FOR SELECT
TO authenticated
USING (
  investor_user_id = auth.uid()
  OR is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.spark_trade_group_brands b
    WHERE b.id = spark_trade_group_brand_investors.group_brand_id
      AND b.founder_user_id = auth.uid()
  )
);

-- 2) Restrict zcreator-videos bucket uploads to owner's folder
DROP POLICY IF EXISTS "zcreator videos auth upload" ON storage.objects;

CREATE POLICY "zcreator videos auth upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zcreator-videos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);