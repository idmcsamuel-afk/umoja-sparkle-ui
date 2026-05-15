-- ============== Tables ==============
CREATE TABLE public.automated_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message_type text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('time_based','event_based')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_template text NOT NULL,
  target_audience text DEFAULT 'all',
  channels jsonb NOT NULL DEFAULT '["community_chat"]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_automated_messages_enabled ON public.automated_messages(enabled, trigger_type);

CREATE TABLE public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automated_message_id uuid REFERENCES public.automated_messages(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  sent_at timestamptz,
  recipient_count integer DEFAULT 0,
  channel text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_messages_status_time ON public.scheduled_messages(status, scheduled_for);

ALTER TABLE public.automated_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage automations" ON public.automated_messages FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin view delivery log" ON public.scheduled_messages FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_automated_messages_updated_at
BEFORE UPDATE ON public.automated_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.scheduled_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;

-- ============== Seed 18 automations ==============
INSERT INTO public.automated_messages (name, message_type, trigger_type, trigger_config, message_template, target_audience, channels) VALUES
('Seed Circle - 15 min before','circle_reminder','time_based','{"time":"07:45","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','⏰ Seed Circle opens in 15 minutes! Get ready to bid (R200-R2K)','all','["community_chat"]'),
('Seed Circle - open','circle_reminder','time_based','{"time":"08:00","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','🌱 Seed Circle is OPEN NOW! Bid closes at 9:00am. Go to /circle','all','["community_chat"]'),
('Seed Circle - 30 min remaining','circle_reminder','time_based','{"time":"08:30","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','⏰ 30 minutes left in Seed Circle! Don''t miss today''s session','all','["community_chat"]'),
('Seed Circle - last 10 min','circle_reminder','time_based','{"time":"08:50","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','🚨 LAST 10 MINUTES! Seed Circle closes at 9:00am','all','["community_chat"]'),
('Seed Circle - closed','circle_reminder','time_based','{"time":"09:00","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','Seed Circle closed. Next session: Tomorrow 8:00am','all','["community_chat"]'),

('Growth Circle - 15 min before','circle_reminder','time_based','{"time":"09:45","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','⏰ Growth Circle opens in 15 minutes! (R2K-R10K)','all','["community_chat"]'),
('Growth Circle - open','circle_reminder','time_based','{"time":"10:00","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','🌿 Growth Circle is OPEN NOW! Bid closes at 11:00am','all','["community_chat"]'),
('Growth Circle - 30 min remaining','circle_reminder','time_based','{"time":"10:30","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','⏰ 30 minutes left in Growth Circle!','all','["community_chat"]'),
('Growth Circle - last 10 min','circle_reminder','time_based','{"time":"10:50","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','🚨 LAST 10 MINUTES! Growth Circle closes at 11:00am','all','["community_chat"]'),
('Growth Circle - closed','circle_reminder','time_based','{"time":"11:00","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"]}','Growth Circle closed. Next session: Tomorrow 10:00am','all','["community_chat"]'),

('Harvest Circle - 15 min before','circle_reminder','time_based','{"time":"08:45","tz":"Africa/Johannesburg","days":["mon","wed","fri"]}','⏰ Harvest Circle opens in 15 minutes! Founders only (R10K+)','founders_only','["community_chat"]'),
('Harvest Circle - open','circle_reminder','time_based','{"time":"09:00","tz":"Africa/Johannesburg","days":["mon","wed","fri"]}','🌾 Harvest Circle is OPEN NOW! Closes at 10:00am. Founders only!','founders_only','["community_chat"]'),
('Harvest Circle - 30 min remaining','circle_reminder','time_based','{"time":"09:30","tz":"Africa/Johannesburg","days":["mon","wed","fri"]}','⏰ 30 minutes left in Harvest Circle!','founders_only','["community_chat"]'),
('Harvest Circle - last 10 min','circle_reminder','time_based','{"time":"09:50","tz":"Africa/Johannesburg","days":["mon","wed","fri"]}','🚨 LAST 10 MINUTES! Harvest Circle closes at 10:00am','founders_only','["community_chat"]'),
('Harvest Circle - closed','circle_reminder','time_based','{"time":"10:00","tz":"Africa/Johannesburg","days":["mon","wed","fri"]}','Harvest Circle closed. Next session: Mon/Wed/Fri 9:00am','founders_only','["community_chat"]'),

('Daily motivation','engagement','time_based','{"time":"07:00","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"],"rotate":["Good morning! 🌅 Today''s the day to build your score. Seed Circle opens at 8am!","New day, new opportunity! 💪 Who''s bidding today?","Consistency beats talent. Show up, bid, repeat. Seed Circle: 8am","The people who win aren''t the smartest. They''re the most consistent. See you at 8am!"]}','Good morning! 🌅 Today''s the day to build your score.','all','["community_chat"]'),
('Weekly leaderboard','engagement','time_based','{"time":"06:00","tz":"Africa/Johannesburg","days":["mon"]}','📊 WEEKLY LEADERBOARD\n\nCheck your ranking: /priority','all','["community_chat","email"]'),
('Activation countdown','milestone','time_based','{"time":"20:00","tz":"Africa/Johannesburg","days":["mon","tue","wed","thu","fri","sat","sun"],"min_members":90}','🚨 {remaining_members} members away from Circle activation! Payouts begin when we hit 100. Invite 3 people: /referrals','all','["community_chat","email"]'),

-- Event-based (handled by DB triggers, kept here for visibility/control)
('New member welcome','engagement','event_based','{"event":"member_joined"}','Welcome {member_name}! 🎉 You''re member #{member_count}. Complete your profile and place your first bid.','all','["community_chat"]'),
('First bid celebration','engagement','event_based','{"event":"first_bid"}','🔥 {member_name} just placed their first bid! Welcome to the queue!','all','["community_chat"]'),
('KYC completed','engagement','event_based','{"event":"kyc_approved"}','✅ {member_name} completed KYC verification! Ready for payouts.','all','["community_chat"]'),
('Founder tier purchase','engagement','event_based','{"event":"founder_tier"}','🎖️ {member_name} just became a {tier} Founder!','all','["community_chat"]'),
('Referral milestone','milestone','event_based','{"event":"referral_milestone","thresholds":[3,5,10]}','🌟 {member_name} just referred their {referral_count}th member! 🔥','all','["community_chat"]'),
('Member count milestone','milestone','event_based','{"event":"member_count","thresholds":[30,40,50,75,90,95,100]}','{member_count} members! Only {remaining_members} left until Circle activation! 🚀','all','["community_chat","email"]');

-- ============== Event-based DB triggers (post to community chat) ==============

-- Welcome new member + member-count milestone
CREATE OR REPLACE FUNCTION public._auto_welcome_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total int; tmpl text; thresholds int[] := ARRAY[30,40,50,75,90,95,100]; t int;
BEGIN
  SELECT COUNT(*) INTO total FROM public.members;
  -- welcome
  IF EXISTS (SELECT 1 FROM public.automated_messages WHERE name='New member welcome' AND enabled) THEN
    SELECT message_template INTO tmpl FROM public.automated_messages WHERE name='New member welcome';
    INSERT INTO public.chat_messages (member_id, message, message_type)
      VALUES (NULL,
        replace(replace(tmpl,'{member_name}', COALESCE(NEW.full_name,'A new member')),'{member_count}', total::text),
        'system');
  END IF;
  -- milestone
  FOREACH t IN ARRAY thresholds LOOP
    IF total = t AND EXISTS (SELECT 1 FROM public.automated_messages WHERE name='Member count milestone' AND enabled) THEN
      SELECT message_template INTO tmpl FROM public.automated_messages WHERE name='Member count milestone';
      INSERT INTO public.chat_messages (member_id, message, message_type)
        VALUES (NULL,
          replace(replace(tmpl,'{member_count}', total::text),'{remaining_members}', GREATEST(0,100-total)::text),
          'system');
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_welcome_member
AFTER INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public._auto_welcome_member();

-- First bid celebration
CREATE OR REPLACE FUNCTION public._auto_first_bid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prior int; nm text; tmpl text;
BEGIN
  SELECT COUNT(*) INTO prior FROM public.circle_bids WHERE member_id = NEW.member_id AND id <> NEW.id;
  IF prior = 0 AND EXISTS (SELECT 1 FROM public.automated_messages WHERE name='First bid celebration' AND enabled) THEN
    SELECT full_name INTO nm FROM public.members WHERE id = NEW.member_id;
    SELECT message_template INTO tmpl FROM public.automated_messages WHERE name='First bid celebration';
    INSERT INTO public.chat_messages (member_id, message, message_type)
      VALUES (NULL, replace(tmpl,'{member_name}', COALESCE(nm,'A member')), 'system');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_first_bid
AFTER INSERT ON public.circle_bids
FOR EACH ROW EXECUTE FUNCTION public._auto_first_bid();

-- KYC approved + founder tier + referral milestone
CREATE OR REPLACE FUNCTION public._auto_member_milestones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tmpl text; refs int; thresh int[] := ARRAY[3,5,10]; t int; mult text;
BEGIN
  -- KYC approved
  IF NEW.kyc_status = 'approved' AND COALESCE(OLD.kyc_status,'') <> 'approved'
     AND EXISTS (SELECT 1 FROM public.automated_messages WHERE name='KYC completed' AND enabled) THEN
    SELECT message_template INTO tmpl FROM public.automated_messages WHERE name='KYC completed';
    INSERT INTO public.chat_messages (member_id, message, message_type)
      VALUES (NULL, replace(tmpl,'{member_name}', COALESCE(NEW.full_name,'A member')), 'system');
  END IF;
  -- Founder tier (buyers club approved)
  IF NEW.has_buyers_club_access = true AND COALESCE(OLD.has_buyers_club_access,false) = false
     AND NEW.buyers_club_tier IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.automated_messages WHERE name='Founder tier purchase' AND enabled) THEN
    mult := CASE lower(NEW.buyers_club_tier) WHEN 'bronze' THEN '2×' WHEN 'silver' THEN '3×' WHEN 'gold' THEN '5×' ELSE '' END;
    SELECT message_template INTO tmpl FROM public.automated_messages WHERE name='Founder tier purchase';
    INSERT INTO public.chat_messages (member_id, message, message_type)
      VALUES (NULL,
        replace(replace(replace(tmpl,'{member_name}', COALESCE(NEW.full_name,'A member')),
                                    '{tier}', initcap(NEW.buyers_club_tier)),
                                    '{multiplier}', mult),
        'system');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_member_milestones
AFTER UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public._auto_member_milestones();

-- Referral milestone fires when a member gains a new referee
CREATE OR REPLACE FUNCTION public._auto_referral_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE refs int; tmpl text; nm text; thresh int[] := ARRAY[3,5,10]; t int;
BEGIN
  IF NEW.referred_by IS NULL OR NEW.referred_by IS NOT DISTINCT FROM OLD.referred_by THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO refs FROM public.members WHERE referred_by = NEW.referred_by;
  FOREACH t IN ARRAY thresh LOOP
    IF refs = t AND EXISTS (SELECT 1 FROM public.automated_messages WHERE name='Referral milestone' AND enabled) THEN
      SELECT full_name INTO nm FROM public.members WHERE id = NEW.referred_by;
      SELECT message_template INTO tmpl FROM public.automated_messages WHERE name='Referral milestone';
      INSERT INTO public.chat_messages (member_id, message, message_type)
        VALUES (NULL,
          replace(replace(tmpl,'{member_name}', COALESCE(nm,'A member')),
                              '{referral_count}', refs::text),
          'system');
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_referral_milestone
AFTER UPDATE OF referred_by ON public.members
FOR EACH ROW EXECUTE FUNCTION public._auto_referral_milestone();