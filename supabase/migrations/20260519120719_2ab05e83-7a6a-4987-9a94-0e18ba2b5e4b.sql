
-- UGC submissions table
CREATE TABLE public.member_ugc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  video_path text,
  platform text NOT NULL,
  social_media_link text NOT NULL,
  caption_used text,
  submission_status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  sparks_rewarded integer NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  reviewed_by uuid REFERENCES public.members(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ugc_submissions_member ON public.member_ugc_submissions(member_id);
CREATE INDEX idx_ugc_submissions_status ON public.member_ugc_submissions(submission_status);

ALTER TABLE public.member_ugc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own ugc submissions"
  ON public.member_ugc_submissions FOR SELECT
  TO authenticated
  USING (member_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Members create own ugc submissions"
  ON public.member_ugc_submissions FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Admins update ugc submissions"
  ON public.member_ugc_submissions FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete ugc submissions"
  ON public.member_ugc_submissions FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Storage bucket for UGC videos (private; admins + owners read via policies)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-ugc-videos',
  'member-ugc-videos',
  true,
  104857600,
  ARRAY['video/mp4','video/quicktime','video/mov','video/webm']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies (objects)
CREATE POLICY "ugc videos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-ugc-videos');

CREATE POLICY "ugc videos owner upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'member-ugc-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "ugc videos owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'member-ugc-videos'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
  );

-- Approve / reject helper (security definer; admin-only)
CREATE OR REPLACE FUNCTION public.admin_review_ugc_submission(
  _submission_id uuid,
  _decision text,
  _notes text DEFAULT NULL,
  _reward integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.member_ugc_submissions%ROWTYPE;
  new_balance numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid decision'; END IF;

  SELECT * INTO s FROM public.member_ugc_submissions WHERE id = _submission_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'submission not found'; END IF;
  IF s.submission_status <> 'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;

  IF _decision = 'approved' THEN
    PERFORM set_config('app.allow_wallet_write', 'on', true);
    INSERT INTO public.spark_wallets (member_id, balance)
      VALUES (s.member_id, GREATEST(0, COALESCE(_reward,200)))
      ON CONFLICT (member_id) DO UPDATE
        SET balance = public.spark_wallets.balance + GREATEST(0, COALESCE(_reward,200)),
            updated_at = now()
      RETURNING balance INTO new_balance;
    PERFORM set_config('app.allow_wallet_write', 'off', true);

    INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status, description)
      VALUES (NULL, s.member_id, COALESCE(_reward,200), 'ugc_video_reward', 'completed',
              'UGC video submission approved');

    UPDATE public.member_ugc_submissions
      SET submission_status='approved',
          sparks_rewarded=COALESCE(_reward,200),
          rewarded_at=now(),
          admin_notes=_notes,
          reviewed_by=auth.uid(),
          reviewed_at=now()
      WHERE id=_submission_id;

    INSERT INTO public.notifications (member_id, title, body, kind, link)
      VALUES (s.member_id, '🎉 Your video was approved!',
              '+' || COALESCE(_reward,200) || ' Sparks earned for sharing on ' || s.platform || '.',
              'ugc', '/my-videos');
  ELSE
    UPDATE public.member_ugc_submissions
      SET submission_status='rejected',
          admin_notes=_notes,
          reviewed_by=auth.uid(),
          reviewed_at=now()
      WHERE id=_submission_id;

    INSERT INTO public.notifications (member_id, title, body, kind, link)
      VALUES (s.member_id, 'Video submission needs improvement',
              COALESCE(_notes,'Please review feedback and resubmit.'),
              'ugc', '/upload-video');
  END IF;

  RETURN jsonb_build_object('ok', true, 'decision', _decision, 'new_balance', new_balance);
END $$;
