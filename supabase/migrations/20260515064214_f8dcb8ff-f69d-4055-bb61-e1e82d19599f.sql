-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) <= 500),
  message_type text NOT NULL DEFAULT 'general' CHECK (message_type IN ('general','win','question','motivation','system')),
  parent_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  likes_count integer NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_parent ON public.chat_messages(parent_message_id);

CREATE TABLE public.chat_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, member_id)
);

CREATE TABLE public.chat_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reply','mention','like')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_notifications_member_unread ON public.chat_notifications(member_id, read);

CREATE TABLE public.chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  muted_until timestamptz NOT NULL,
  reason text,
  muted_by uuid REFERENCES public.members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_mutes_member ON public.chat_mutes(member_id, muted_until DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE POLICY "view all messages" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "create own messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = member_id
    AND NOT EXISTS (SELECT 1 FROM public.chat_mutes WHERE member_id = auth.uid() AND muted_until > now())
  );
CREATE POLICY "update own messages" ON public.chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = member_id OR public.is_admin(auth.uid()));
CREATE POLICY "delete own or admin" ON public.chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = member_id OR public.is_admin(auth.uid()));

-- Likes
CREATE POLICY "view likes" ON public.chat_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "create own likes" ON public.chat_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "delete own likes" ON public.chat_likes FOR DELETE TO authenticated USING (auth.uid() = member_id);

-- Notifications
CREATE POLICY "view own notifications" ON public.chat_notifications FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY "system inserts notifications" ON public.chat_notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update own notifications" ON public.chat_notifications FOR UPDATE TO authenticated USING (auth.uid() = member_id);

-- Reports
CREATE POLICY "create reports" ON public.chat_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "admin view reports" ON public.chat_reports FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admin update reports" ON public.chat_reports FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Mutes
CREATE POLICY "view own mutes" ON public.chat_mutes FOR SELECT TO authenticated USING (auth.uid() = member_id OR public.is_admin(auth.uid()));
CREATE POLICY "admin manage mutes" ON public.chat_mutes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Likes count trigger
CREATE OR REPLACE FUNCTION public._chat_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_messages SET likes_count = likes_count + 1 WHERE id = NEW.message_id;
    -- notify author
    INSERT INTO public.chat_notifications (member_id, message_id, type)
    SELECT m.member_id, NEW.message_id, 'like'
      FROM public.chat_messages m
     WHERE m.id = NEW.message_id AND m.member_id IS NOT NULL AND m.member_id <> NEW.member_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.chat_messages SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.message_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_chat_likes_count
AFTER INSERT OR DELETE ON public.chat_likes
FOR EACH ROW EXECUTE FUNCTION public._chat_likes_count();

-- Reply notification trigger
CREATE OR REPLACE FUNCTION public._chat_reply_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.parent_message_id IS NOT NULL THEN
    INSERT INTO public.chat_notifications (member_id, message_id, type)
    SELECT p.member_id, NEW.id, 'reply'
      FROM public.chat_messages p
     WHERE p.id = NEW.parent_message_id AND p.member_id IS NOT NULL AND p.member_id <> NEW.member_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_chat_reply_notify
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public._chat_reply_notify();

CREATE TRIGGER trg_chat_messages_updated_at
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_likes REPLICA IDENTITY FULL;
ALTER TABLE public.chat_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_notifications;