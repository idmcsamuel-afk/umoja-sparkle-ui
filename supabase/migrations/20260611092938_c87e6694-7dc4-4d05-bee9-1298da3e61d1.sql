
-- 1) chat_notifications: restrict INSERT to admins/self (SECURITY DEFINER triggers bypass RLS)
DROP POLICY IF EXISTS "system inserts notifications" ON public.chat_notifications;
CREATE POLICY "members insert own notifications"
  ON public.chat_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = member_id OR is_admin(auth.uid()));

-- 2) podcast_analytics: require authenticated insert with user_id=self or null
DROP POLICY IF EXISTS "podcast_analytics_insert_any" ON public.podcast_analytics;
CREATE POLICY "podcast_analytics_insert_self"
  ON public.podcast_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 3) spark_trade_subscriptions: restrict INSERT to authenticated users for themselves
DROP POLICY IF EXISTS "Anyone can create spark trade sub" ON public.spark_trade_subscriptions;
CREATE POLICY "Users create own spark trade sub"
  ON public.spark_trade_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4) withdrawal_requests: add explicit INSERT policy for members
DROP POLICY IF EXISTS "Members create own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Members create own withdrawals"
  ON public.withdrawal_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());
