
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,
  featured_image text,
  author_id uuid,
  author_name text DEFAULT 'Mcsamuel',
  category text DEFAULT 'update',
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  read_time_minutes integer DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_posts_published ON public.blog_posts (published, published_at DESC);
CREATE INDEX idx_blog_posts_category ON public.blog_posts (category);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_public_read_published" ON public.blog_posts
  FOR SELECT USING (published = true);
CREATE POLICY "blog_admin_read_all" ON public.blog_posts
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "blog_admin_insert" ON public.blog_posts
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "blog_admin_update" ON public.blog_posts
  FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "blog_admin_delete" ON public.blog_posts
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.blog_posts (slug, title, excerpt, content, category, published, published_at, read_time_minutes, author_name)
VALUES (
  'founding-member-guide',
  'Founding Member Guide: Everything You Need to Know',
  'A complete guide for UMOJA founding members — what you get, how the platform works, and how to make the most of your founder status.',
  E'## Welcome, Founder\n\nYou are one of the first members of UMOJA. This guide walks you through everything you need to know to make the most of your founding status.\n\n## What is UMOJA?\n\nUMOJA is a community wealth platform combining stokvel-style Circles, a vehicle ownership program (Drive), property fund, and a creator marketplace — all powered by transparent, merit-based allocation.\n\n## Your Founder Benefits\n\n- **Lifetime priority** in Circle allocations\n- **Reduced fees** on Spark Trade and Drive\n- **Founder badge** visible to the community\n- **Early access** to every new product\n- **Direct line** to the founding team\n\n## How Circles Work\n\n1. Pick a tier that matches your monthly capacity\n2. Place a bid each session\n3. Earn priority by paying on time and referring members\n4. Win an allocation when the algorithm matches you\n5. Receive your payout (95% net after platform + Ubuntu fund)\n\n## How Drive Works\n\nThree tiers — Economy, Standard, Premium. Contribute weekly, earn merit points, and the top scorers each cycle drive home a car. After winning, you continue weekly payments until the vehicle is fully paid off and papers are released.\n\n## Tips for Success\n\n- **Pay on time, every time.** Consistency is the single biggest score driver.\n- **Refer real people.** Quality referrals compound your priority score.\n- **Engage in the community.** Founders who post, comment, and help newcomers move up the ranks fastest.\n\n## Need Help?\n\nUse the in-app chat or email support@umoja.app. Founders get priority response times.\n\n> "We rise by lifting others." — Welcome to the movement.',
  'guide', true, now(), 6, 'Mcsamuel'
);
