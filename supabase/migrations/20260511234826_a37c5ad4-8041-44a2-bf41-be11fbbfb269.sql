
-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.storefronts (
  member_id uuid PRIMARY KEY,
  display_name text,
  bio text,
  banner_url text,
  accent_color text NOT NULL DEFAULT '#C9A84C',
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storefronts_public_read" ON public.storefronts
  FOR SELECT TO anon, authenticated USING (is_active = true OR auth.uid() = member_id OR public.is_admin(auth.uid()));
CREATE POLICY "storefronts_owner_insert" ON public.storefronts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "storefronts_owner_update" ON public.storefronts
  FOR UPDATE TO authenticated USING (auth.uid() = member_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = member_id OR public.is_admin(auth.uid()));
CREATE POLICY "storefronts_admin_delete" ON public.storefronts
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_storefront() RETURNS trigger
  LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER storefronts_touch BEFORE UPDATE ON public.storefronts
  FOR EACH ROW EXECUTE FUNCTION public.touch_storefront();

-- Reviews
CREATE TABLE IF NOT EXISTS public.storefront_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_owner_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storefront_owner_id, reviewer_id)
);
ALTER TABLE public.storefront_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS storefront_reviews_owner_idx ON public.storefront_reviews(storefront_owner_id);

CREATE POLICY "reviews_public_read" ON public.storefront_reviews
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reviews_insert_self" ON public.storefront_reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id AND reviewer_id <> storefront_owner_id);
CREATE POLICY "reviews_admin_delete" ON public.storefront_reviews
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = reviewer_id);

-- Spark trade joins (per-member tracking)
CREATE TABLE IF NOT EXISTS public.spark_trade_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  shortlist_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, shortlist_id)
);
ALTER TABLE public.spark_trade_joins ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS spark_trade_joins_member_idx ON public.spark_trade_joins(member_id);

CREATE POLICY "stj_select" ON public.spark_trade_joins
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "stj_insert_self" ON public.spark_trade_joins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "stj_delete_self" ON public.spark_trade_joins
  FOR DELETE TO authenticated USING (auth.uid() = member_id OR public.is_admin(auth.uid()));

-- Update join_spark_trade RPC to record the joining member
CREATE OR REPLACE FUNCTION public.join_spark_trade(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.spark_trade_shortlist
     SET joined_count = COALESCE(joined_count,0) + 1
   WHERE id = _id
     AND COALESCE(joined_count,0) < COALESCE(target_slots, 0);
  INSERT INTO public.spark_trade_joins (member_id, shortlist_id)
    VALUES (auth.uid(), _id)
    ON CONFLICT (member_id, shortlist_id) DO NOTHING;
END $function$;

-- View counter increment (public, rate-soft via no auth check)
CREATE OR REPLACE FUNCTION public.increment_storefront_view(_owner uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  UPDATE public.storefronts SET view_count = view_count + 1 WHERE member_id = _owner;
$$;

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
  VALUES ('storefront-banners', 'storefront-banners', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "banners_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'storefront-banners');
CREATE POLICY "banners_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'storefront-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "banners_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'storefront-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "banners_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'storefront-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
