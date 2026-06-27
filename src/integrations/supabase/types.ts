export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_member: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_member?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_member?: string | null
        }
        Relationships: []
      }
      admin_invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          uses_remaining: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          uses_remaining?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          uses_remaining?: number
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_avatars: {
        Row: {
          created_at: string
          heygen_avatar_id: string | null
          id: string
          is_active: boolean
          member_selectable: boolean
          name: string
          performance_score: number
          persona_description: string | null
          preview_image_url: string | null
          times_used: number
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          heygen_avatar_id?: string | null
          id?: string
          is_active?: boolean
          member_selectable?: boolean
          name: string
          performance_score?: number
          persona_description?: string | null
          preview_image_url?: string | null
          times_used?: number
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          heygen_avatar_id?: string | null
          id?: string
          is_active?: boolean
          member_selectable?: boolean
          name?: string
          performance_score?: number
          persona_description?: string | null
          preview_image_url?: string | null
          times_used?: number
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      ai_content_campaigns: {
        Row: {
          autonomous_settings: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          platforms: Json
          started_at: string
          status: string
          target_posts_per_day: number
          target_videos_per_day: number
          updated_at: string
        }
        Insert: {
          autonomous_settings?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          platforms?: Json
          started_at?: string
          status?: string
          target_posts_per_day?: number
          target_videos_per_day?: number
          updated_at?: string
        }
        Update: {
          autonomous_settings?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          platforms?: Json
          started_at?: string
          status?: string
          target_posts_per_day?: number
          target_videos_per_day?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_scripts: {
        Row: {
          campaign_id: string | null
          created_at: string
          generated_by: string
          hook: string | null
          id: string
          member_template: boolean
          performance_score: number | null
          persona_index: number | null
          script_text: string
          script_type: string | null
          template_title: string | null
          used_count: number
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          generated_by?: string
          hook?: string | null
          id?: string
          member_template?: boolean
          performance_score?: number | null
          persona_index?: number | null
          script_text: string
          script_type?: string | null
          template_title?: string | null
          used_count?: number
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          generated_by?: string
          hook?: string | null
          id?: string
          member_template?: boolean
          performance_score?: number | null
          persona_index?: number | null
          script_text?: string
          script_type?: string | null
          template_title?: string | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_scripts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_content_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_videos: {
        Row: {
          avatar_id: string | null
          campaign_id: string | null
          caption_facebook: string | null
          caption_instagram: string | null
          caption_tiktok: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          generation_status: string
          hashtags: string | null
          heygen_video_id: string | null
          id: string
          script_id: string | null
          thumbnail_url: string | null
          updated_at: string
          video_caption: string | null
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          avatar_id?: string | null
          campaign_id?: string | null
          caption_facebook?: string | null
          caption_instagram?: string | null
          caption_tiktok?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          generation_status?: string
          hashtags?: string | null
          heygen_video_id?: string | null
          id?: string
          script_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_caption?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          avatar_id?: string | null
          campaign_id?: string | null
          caption_facebook?: string | null
          caption_instagram?: string | null
          caption_tiktok?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          generation_status?: string
          hashtags?: string | null
          heygen_video_id?: string | null
          id?: string
          script_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_caption?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_videos_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_videos_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_content_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_videos_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_preferences: {
        Row: {
          auto_email_campaigns: boolean
          auto_generate_listings: boolean
          auto_optimize_pricing: boolean
          auto_social_posts: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_email_campaigns?: boolean
          auto_generate_listings?: boolean
          auto_optimize_pricing?: boolean
          auto_social_posts?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_email_campaigns?: boolean
          auto_generate_listings?: boolean
          auto_optimize_pricing?: boolean
          auto_social_posts?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_scheduled_posts: {
        Row: {
          created_at: string
          engagement_metrics: Json | null
          error_message: string | null
          id: string
          platform: string
          post_status: string
          post_url: string | null
          posted_at: string | null
          scheduled_for: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          engagement_metrics?: Json | null
          error_message?: string | null
          id?: string
          platform: string
          post_status?: string
          post_url?: string | null
          posted_at?: string | null
          scheduled_for: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          engagement_metrics?: Json | null
          error_message?: string | null
          id?: string
          platform?: string
          post_status?: string
          post_url?: string | null
          posted_at?: string | null
          scheduled_for?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_scheduled_posts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_subscriptions: {
        Row: {
          id: string
          is_active: boolean | null
          member_id: string
          renews_at: string | null
          started_at: string | null
          tier: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          member_id: string
          renews_at?: string | null
          started_at?: string | null
          tier?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          member_id?: string
          renews_at?: string | null
          started_at?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_integration_settings: {
        Row: {
          api_connected: boolean
          bsr_threshold: number
          created_at: string
          exchange_rate_zar_per_usd: number
          id: string
          last_sync_at: string | null
          tracked_categories: string[]
          updated_at: string
        }
        Insert: {
          api_connected?: boolean
          bsr_threshold?: number
          created_at?: string
          exchange_rate_zar_per_usd?: number
          id?: string
          last_sync_at?: string | null
          tracked_categories?: string[]
          updated_at?: string
        }
        Update: {
          api_connected?: boolean
          bsr_threshold?: number
          created_at?: string
          exchange_rate_zar_per_usd?: number
          id?: string
          last_sync_at?: string | null
          tracked_categories?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      amazon_products: {
        Row: {
          asin: string
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          import_cost_zar: number | null
          last_updated: string
          opportunity_score: number | null
          price_advantage: number | null
          price_usd: number | null
          price_zar: number | null
          rating: number | null
          review_count: number | null
          sa_available: boolean | null
          sa_price_zar: number | null
          sales_rank: number | null
          title: string
        }
        Insert: {
          asin: string
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          import_cost_zar?: number | null
          last_updated?: string
          opportunity_score?: number | null
          price_advantage?: number | null
          price_usd?: number | null
          price_zar?: number | null
          rating?: number | null
          review_count?: number | null
          sa_available?: boolean | null
          sa_price_zar?: number | null
          sales_rank?: number | null
          title: string
        }
        Update: {
          asin?: string
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          import_cost_zar?: number | null
          last_updated?: string
          opportunity_score?: number | null
          price_advantage?: number | null
          price_usd?: number | null
          price_zar?: number | null
          rating?: number | null
          review_count?: number | null
          sa_available?: boolean | null
          sa_price_zar?: number | null
          sales_rank?: number | null
          title?: string
        }
        Relationships: []
      }
      automated_messages: {
        Row: {
          channels: Json
          created_at: string
          enabled: boolean
          id: string
          last_triggered_at: string | null
          message_template: string
          message_type: string
          name: string
          target_audience: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          channels?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          message_template: string
          message_type: string
          name: string
          target_audience?: string | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          channels?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          message_template?: string
          message_type?: string
          name?: string
          target_audience?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_holder: string
          account_name: string
          account_number: string
          bank_name: string
          branch_code: string
          created_at: string
          created_by: string | null
          for_buyers_club: boolean
          for_circle: boolean
          for_drive: boolean
          for_property: boolean
          for_spark_trade: boolean
          id: string
          is_active: boolean
          is_default: boolean
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_name: string
          account_number: string
          bank_name: string
          branch_code: string
          created_at?: string
          created_by?: string | null
          for_buyers_club?: boolean
          for_circle?: boolean
          for_drive?: boolean
          for_property?: boolean
          for_spark_trade?: boolean
          id?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_name?: string
          account_number?: string
          bank_name?: string
          branch_code?: string
          created_at?: string
          created_by?: string | null
          for_buyers_club?: boolean
          for_circle?: boolean
          for_drive?: boolean
          for_property?: boolean
          for_spark_trade?: boolean
          id?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          category: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          published: boolean
          published_at: string | null
          read_time_minutes: number | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          category?: string | null
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          read_time_minutes?: number | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          category?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          read_time_minutes?: number | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_likes: {
        Row: {
          created_at: string
          id: string
          member_id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          message_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_likes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_likes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean
          likes_count: number
          member_id: string | null
          message: string
          message_type: string
          parent_message_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          member_id?: string | null
          message: string
          message_type?: string
          parent_message_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          member_id?: string | null
          message?: string
          message_type?: string
          parent_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mutes: {
        Row: {
          created_at: string
          id: string
          member_id: string
          muted_by: string | null
          muted_until: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          muted_by?: string | null
          muted_until: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          muted_by?: string | null
          muted_until?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_mutes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mutes_muted_by_fkey"
            columns: ["muted_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_notifications: {
        Row: {
          created_at: string
          id: string
          member_id: string
          message_id: string
          read: boolean
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          message_id: string
          read?: boolean
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          message_id?: string
          read?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reports: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reason: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reason?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reason?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      china_supplier_prices: {
        Row: {
          admin_notes: string | null
          fob_price_cny: number
          fob_price_zar: number
          id: string
          last_updated: string | null
          lead_time_days: number | null
          moq: number | null
          product_id: string | null
          shipping_weight_kg: number | null
          supplier: string
          supplier_product_id: string | null
          supplier_url: string | null
          verified_by_admin: boolean | null
        }
        Insert: {
          admin_notes?: string | null
          fob_price_cny: number
          fob_price_zar: number
          id?: string
          last_updated?: string | null
          lead_time_days?: number | null
          moq?: number | null
          product_id?: string | null
          shipping_weight_kg?: number | null
          supplier: string
          supplier_product_id?: string | null
          supplier_url?: string | null
          verified_by_admin?: boolean | null
        }
        Update: {
          admin_notes?: string | null
          fob_price_cny?: number
          fob_price_zar?: number
          id?: string
          last_updated?: string | null
          lead_time_days?: number | null
          moq?: number | null
          product_id?: string | null
          shipping_weight_kg?: number | null
          supplier?: string
          supplier_product_id?: string | null
          supplier_url?: string | null
          verified_by_admin?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "china_supplier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trending_products"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_allocation_overrides: {
        Row: {
          applied_to_allocation: string | null
          bid_id: string
          boost_value: number
          consumed: boolean
          created_at: string
          created_by: string | null
          id: string
          override_type: string
          reason: string | null
          tier: string
        }
        Insert: {
          applied_to_allocation?: string | null
          bid_id: string
          boost_value?: number
          consumed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          override_type: string
          reason?: string | null
          tier: string
        }
        Update: {
          applied_to_allocation?: string | null
          bid_id?: string
          boost_value?: number
          consumed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          override_type?: string
          reason?: string | null
          tier?: string
        }
        Relationships: []
      }
      circle_allocations: {
        Row: {
          breakdown: Json | null
          created_at: string
          created_by: string | null
          id: string
          payout_per_winner: number
          pool_total: number
          session_at: string
          tier: string
          winners_count: number
        }
        Insert: {
          breakdown?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          payout_per_winner?: number
          pool_total?: number
          session_at?: string
          tier: string
          winners_count?: number
        }
        Update: {
          breakdown?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          payout_per_winner?: number
          pool_total?: number
          session_at?: string
          tier?: string
          winners_count?: number
        }
        Relationships: []
      }
      circle_bid_status_events: {
        Row: {
          actor_id: string | null
          bid_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          bid_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          bid_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: []
      }
      circle_bids: {
        Row: {
          allocated_at: string | null
          amount_usd: number | null
          amount_usdt: number | null
          amount_usdt_received: number | null
          boost_count: number
          consistency_percentage: number | null
          created_at: string | null
          currency_code: string
          days_waiting: number | null
          exchange_rate: number | null
          expiration_notified: boolean | null
          fiat_amount: number
          id: string
          is_first_payout: boolean
          last_boost_at: string | null
          matched_to: string | null
          member_id: string
          net_amount: number
          payment_completed_at: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_crypto_address: string | null
          payment_crypto_network: string | null
          payment_crypto_txhash: string | null
          payment_deadline: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_ref: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_submitted_at: string | null
          payment_window_hours: number | null
          payout_amount: number | null
          payout_crypto_network: string | null
          payout_crypto_txhash: string | null
          payout_date: string | null
          payout_rank: number | null
          paystack_reference: string | null
          platform_fee: number
          priority_score: number | null
          priority_slot: boolean | null
          proof_extended_until: string | null
          quarantine_reason: string | null
          quarantined_at: string | null
          score_breakdown: Json | null
          spark_amount: number
          status: string | null
          streak_bonus: number | null
          tier: string
          total_sparks_spent_on_boosts: number
          ubuntu_fund_cut: number
          updated_at: string | null
          vault_end: string | null
          vault_start: string | null
        }
        Insert: {
          allocated_at?: string | null
          amount_usd?: number | null
          amount_usdt?: number | null
          amount_usdt_received?: number | null
          boost_count?: number
          consistency_percentage?: number | null
          created_at?: string | null
          currency_code?: string
          days_waiting?: number | null
          exchange_rate?: number | null
          expiration_notified?: boolean | null
          fiat_amount: number
          id?: string
          is_first_payout?: boolean
          last_boost_at?: string | null
          matched_to?: string | null
          member_id: string
          net_amount: number
          payment_completed_at?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_crypto_address?: string | null
          payment_crypto_network?: string | null
          payment_crypto_txhash?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_ref?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_submitted_at?: string | null
          payment_window_hours?: number | null
          payout_amount?: number | null
          payout_crypto_network?: string | null
          payout_crypto_txhash?: string | null
          payout_date?: string | null
          payout_rank?: number | null
          paystack_reference?: string | null
          platform_fee: number
          priority_score?: number | null
          priority_slot?: boolean | null
          proof_extended_until?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          score_breakdown?: Json | null
          spark_amount: number
          status?: string | null
          streak_bonus?: number | null
          tier: string
          total_sparks_spent_on_boosts?: number
          ubuntu_fund_cut: number
          updated_at?: string | null
          vault_end?: string | null
          vault_start?: string | null
        }
        Update: {
          allocated_at?: string | null
          amount_usd?: number | null
          amount_usdt?: number | null
          amount_usdt_received?: number | null
          boost_count?: number
          consistency_percentage?: number | null
          created_at?: string | null
          currency_code?: string
          days_waiting?: number | null
          exchange_rate?: number | null
          expiration_notified?: boolean | null
          fiat_amount?: number
          id?: string
          is_first_payout?: boolean
          last_boost_at?: string | null
          matched_to?: string | null
          member_id?: string
          net_amount?: number
          payment_completed_at?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_crypto_address?: string | null
          payment_crypto_network?: string | null
          payment_crypto_txhash?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_ref?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_submitted_at?: string | null
          payment_window_hours?: number | null
          payout_amount?: number | null
          payout_crypto_network?: string | null
          payout_crypto_txhash?: string | null
          payout_date?: string | null
          payout_rank?: number | null
          paystack_reference?: string | null
          platform_fee?: number
          priority_score?: number | null
          priority_slot?: boolean | null
          proof_extended_until?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          score_breakdown?: Json | null
          spark_amount?: number
          status?: string | null
          streak_bonus?: number | null
          tier?: string
          total_sparks_spent_on_boosts?: number
          ubuntu_fund_cut?: number
          updated_at?: string | null
          vault_end?: string | null
          vault_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circle_bids_matched_to_fkey"
            columns: ["matched_to"]
            isOneToOne: false
            referencedRelation: "circle_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_bids_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_bids_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "circle_tiers"
            referencedColumns: ["tier"]
          },
        ]
      }
      circle_boosts: {
        Row: {
          bid_id: string
          boost_number: number
          created_at: string
          id: string
          member_id: string
          new_priority_score: number | null
          old_priority_score: number | null
          position_after: number | null
          position_before: number | null
          priority_boost_amount: number
          sparks_cost: number
        }
        Insert: {
          bid_id: string
          boost_number: number
          created_at?: string
          id?: string
          member_id: string
          new_priority_score?: number | null
          old_priority_score?: number | null
          position_after?: number | null
          position_before?: number | null
          priority_boost_amount?: number
          sparks_cost?: number
        }
        Update: {
          bid_id?: string
          boost_number?: number
          created_at?: string
          id?: string
          member_id?: string
          new_priority_score?: number | null
          old_priority_score?: number | null
          position_after?: number | null
          position_before?: number | null
          priority_boost_amount?: number
          sparks_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "circle_boosts_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "circle_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_boosts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_payouts: {
        Row: {
          circle_id: string | null
          circle_tier: string | null
          created_at: string
          id: string
          member_id: string
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          payout_amount: number
          payout_period: string
          status: string
          updated_at: string
        }
        Insert: {
          circle_id?: string | null
          circle_tier?: string | null
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          payout_amount: number
          payout_period: string
          status?: string
          updated_at?: string
        }
        Update: {
          circle_id?: string | null
          circle_tier?: string | null
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          payout_amount?: number
          payout_period?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_payouts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_score_snapshots: {
        Row: {
          allocation_id: string | null
          bid_id: string | null
          breakdown: Json | null
          created_at: string
          eligible: boolean
          id: string
          member_id: string
          priority_score: number
          rank: number | null
          session_at: string
          tier: string
        }
        Insert: {
          allocation_id?: string | null
          bid_id?: string | null
          breakdown?: Json | null
          created_at?: string
          eligible?: boolean
          id?: string
          member_id: string
          priority_score?: number
          rank?: number | null
          session_at?: string
          tier: string
        }
        Update: {
          allocation_id?: string | null
          bid_id?: string | null
          breakdown?: Json | null
          created_at?: string
          eligible?: boolean
          id?: string
          member_id?: string
          priority_score?: number
          rank?: number | null
          session_at?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_score_snapshots_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "circle_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_tiers: {
        Row: {
          daily_velocity_cap: number
          growth_rate: number
          is_active: boolean | null
          max_entry: number
          min_entry: number
          sessions_per_day: number | null
          tier: string
          vault_days: number
        }
        Insert: {
          daily_velocity_cap: number
          growth_rate: number
          is_active?: boolean | null
          max_entry: number
          min_entry: number
          sessions_per_day?: number | null
          tier: string
          vault_days: number
        }
        Update: {
          daily_velocity_cap?: number
          growth_rate?: number
          is_active?: boolean | null
          max_entry?: number
          min_entry?: number
          sessions_per_day?: number | null
          tier?: string
          vault_days?: number
        }
        Relationships: []
      }
      core_ledger: {
        Row: {
          amount: number
          created_at: string | null
          event_type: string
          id: string
          member_id: string
          note: string | null
          reference_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          event_type: string
          id?: string
          member_id: string
          note?: string | null
          reference_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          event_type?: string
          id?: string
          member_id?: string
          note?: string | null
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "core_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      country_configs: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          currency_code: string
          currency_symbol: string
          enabled: boolean
          growth_max: number
          growth_min: number
          harvest_max: number
          harvest_min: number
          id: string
          max_monthly_contribution: number | null
          monthly_price: number | null
          payment_gateways: Json
          requires_kyc: boolean
          seed_max: number
          seed_min: number
          updated_at: string
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          currency_code: string
          currency_symbol: string
          enabled?: boolean
          growth_max: number
          growth_min: number
          harvest_max: number
          harvest_min: number
          id?: string
          max_monthly_contribution?: number | null
          monthly_price?: number | null
          payment_gateways?: Json
          requires_kyc?: boolean
          seed_max: number
          seed_min: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          enabled?: boolean
          growth_max?: number
          growth_min?: number
          harvest_max?: number
          harvest_min?: number
          id?: string
          max_monthly_contribution?: number | null
          monthly_price?: number | null
          payment_gateways?: Json
          requires_kyc?: boolean
          seed_max?: number
          seed_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      country_waitlist: {
        Row: {
          country_code: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      currency_rates: {
        Row: {
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          rate: number
          source: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          from_currency: string
          id?: string
          rate: number
          source?: string
          to_currency: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string
          to_currency?: string
        }
        Relationships: []
      }
      dream_draw_entries: {
        Row: {
          cost_sparks: number
          created_at: string | null
          draw_date: string
          id: string
          member_id: string
          prize: number | null
          tickets: number
          won: boolean | null
        }
        Insert: {
          cost_sparks: number
          created_at?: string | null
          draw_date?: string
          id?: string
          member_id: string
          prize?: number | null
          tickets: number
          won?: boolean | null
        }
        Update: {
          cost_sparks?: number
          created_at?: string | null
          draw_date?: string
          id?: string
          member_id?: string
          prize?: number | null
          tickets?: number
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "dream_draw_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_allocations: {
        Row: {
          allocation_date: string
          allocation_results: Json | null
          cars_allocated: number
          created_at: string
          created_by: string | null
          id: string
          pool_amount: number
          tier_id: string
        }
        Insert: {
          allocation_date?: string
          allocation_results?: Json | null
          cars_allocated: number
          created_at?: string
          created_by?: string | null
          id?: string
          pool_amount: number
          tier_id: string
        }
        Update: {
          allocation_date?: string
          allocation_results?: Json | null
          cars_allocated?: number
          created_at?: string
          created_by?: string | null
          id?: string
          pool_amount?: number
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_allocations_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "drive_tier_pool_v"
            referencedColumns: ["tier_id"]
          },
          {
            foreignKeyName: "drive_allocations_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "drive_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_circles: {
        Row: {
          created_at: string | null
          current_pool: number | null
          id: string
          members_count: number | null
          name: string | null
          status: string | null
          target_pool: number
          tier_id: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_pool?: number | null
          id?: string
          members_count?: number | null
          name?: string | null
          status?: string | null
          target_pool: number
          tier_id?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_pool?: number | null
          id?: string
          members_count?: number | null
          name?: string | null
          status?: string | null
          target_pool?: number
          tier_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_circles_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "drive_tier_pool_v"
            referencedColumns: ["tier_id"]
          },
          {
            foreignKeyName: "drive_circles_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "drive_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_contributions: {
        Row: {
          amount: number
          created_at: string
          enrollment_id: string
          id: string
          is_on_time: boolean
          member_id: string
          payment_date: string
          payment_method: string | null
          payment_proof_url: string | null
          payment_ref: string | null
          quarantine_reason: string | null
          quarantined_at: string | null
          status: string
          week_number: number
        }
        Insert: {
          amount: number
          created_at?: string
          enrollment_id: string
          id?: string
          is_on_time?: boolean
          member_id: string
          payment_date?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_ref?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          status?: string
          week_number: number
        }
        Update: {
          amount?: number
          created_at?: string
          enrollment_id?: string
          id?: string
          is_on_time?: boolean
          member_id?: string
          payment_date?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_ref?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          status?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "drive_contributions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "drive_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_enrollments: {
        Row: {
          completed_at: string | null
          enrolled_at: string
          id: string
          member_id: string
          priority_score: number
          referrals_count: number
          status: string
          tier_id: string
          total_contributed: number
          weekly_amount: number
          weeks_contributed: number
          weeks_paid_on_time: number
          won_at: string | null
        }
        Insert: {
          completed_at?: string | null
          enrolled_at?: string
          id?: string
          member_id: string
          priority_score?: number
          referrals_count?: number
          status?: string
          tier_id: string
          total_contributed?: number
          weekly_amount?: number
          weeks_contributed?: number
          weeks_paid_on_time?: number
          won_at?: string | null
        }
        Update: {
          completed_at?: string | null
          enrolled_at?: string
          id?: string
          member_id?: string
          priority_score?: number
          referrals_count?: number
          status?: string
          tier_id?: string
          total_contributed?: number
          weekly_amount?: number
          weeks_contributed?: number
          weeks_paid_on_time?: number
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_enrollments_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "drive_tier_pool_v"
            referencedColumns: ["tier_id"]
          },
          {
            foreignKeyName: "drive_enrollments_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "drive_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_members: {
        Row: {
          circle_id: string | null
          id: string
          joined_at: string | null
          member_id: string | null
          payment_method: string | null
          payment_ref: string | null
          paystack_reference: string | null
          status: string | null
          total_contributed: number | null
        }
        Insert: {
          circle_id?: string | null
          id?: string
          joined_at?: string | null
          member_id?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          paystack_reference?: string | null
          status?: string | null
          total_contributed?: number | null
        }
        Update: {
          circle_id?: string | null
          id?: string
          joined_at?: string | null
          member_id?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          paystack_reference?: string | null
          status?: string | null
          total_contributed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "drive_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_notification_prefs: {
        Row: {
          circle_id: string
          created_at: string
          email: boolean
          id: string
          in_app: boolean
          member_id: string
          push: boolean
          updated_at: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          email?: boolean
          id?: string
          in_app?: boolean
          member_id: string
          push?: boolean
          updated_at?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          email?: boolean
          id?: string
          in_app?: boolean
          member_id?: string
          push?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      drive_repayments: {
        Row: {
          amount: number
          circle_id: string | null
          created_at: string | null
          id: string
          member_id: string | null
          paid_at: string | null
          status: string | null
          week_number: number | null
        }
        Insert: {
          amount: number
          circle_id?: string | null
          created_at?: string | null
          id?: string
          member_id?: string | null
          paid_at?: string | null
          status?: string | null
          week_number?: number | null
        }
        Update: {
          amount?: number
          circle_id?: string | null
          created_at?: string | null
          id?: string
          member_id?: string | null
          paid_at?: string | null
          status?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_repayments_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "drive_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_tiers: {
        Row: {
          car_image_url: string | null
          car_make: string | null
          car_model: string | null
          car_year: number | null
          cars_per_allocation: number | null
          circle_size: number
          created_at: string | null
          description: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          min_contribution_before: number | null
          name: string
          payback_weeks: number | null
          pool_target: number
          requires_buyers_club_tier: string | null
          retail_value: number | null
          status: string | null
          tier_name: string | null
          umoja_cost: number | null
          vehicle_description: string | null
          weekly_contribution: number
          weekly_payment_after: number | null
          weekly_payment_before_max: number | null
          weekly_payment_before_min: number | null
        }
        Insert: {
          car_image_url?: string | null
          car_make?: string | null
          car_model?: string | null
          car_year?: number | null
          cars_per_allocation?: number | null
          circle_size: number
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          min_contribution_before?: number | null
          name: string
          payback_weeks?: number | null
          pool_target: number
          requires_buyers_club_tier?: string | null
          retail_value?: number | null
          status?: string | null
          tier_name?: string | null
          umoja_cost?: number | null
          vehicle_description?: string | null
          weekly_contribution: number
          weekly_payment_after?: number | null
          weekly_payment_before_max?: number | null
          weekly_payment_before_min?: number | null
        }
        Update: {
          car_image_url?: string | null
          car_make?: string | null
          car_model?: string | null
          car_year?: number | null
          cars_per_allocation?: number | null
          circle_size?: number
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          min_contribution_before?: number | null
          name?: string
          payback_weeks?: number | null
          pool_target?: number
          requires_buyers_club_tier?: string | null
          retail_value?: number | null
          status?: string | null
          tier_name?: string | null
          umoja_cost?: number | null
          vehicle_description?: string | null
          weekly_contribution?: number
          weekly_payment_after?: number | null
          weekly_payment_before_max?: number | null
          weekly_payment_before_min?: number | null
        }
        Relationships: []
      }
      drive_winners: {
        Row: {
          allocation_id: string | null
          created_at: string
          enrollment_id: string
          gps_tracker_id: string | null
          handover_date: string | null
          id: string
          member_id: string
          papers_released: boolean
          tier_id: string
          total_paid_back: number
          vehicle_details: Json | null
          weekly_payback: number
          weeks_remaining: number | null
        }
        Insert: {
          allocation_id?: string | null
          created_at?: string
          enrollment_id: string
          gps_tracker_id?: string | null
          handover_date?: string | null
          id?: string
          member_id: string
          papers_released?: boolean
          tier_id: string
          total_paid_back?: number
          vehicle_details?: Json | null
          weekly_payback: number
          weeks_remaining?: number | null
        }
        Update: {
          allocation_id?: string | null
          created_at?: string
          enrollment_id?: string
          gps_tracker_id?: string | null
          handover_date?: string | null
          id?: string
          member_id?: string
          papers_released?: boolean
          tier_id?: string
          total_paid_back?: number
          vehicle_details?: Json | null
          weekly_payback?: number
          weeks_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_winners_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "drive_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_winners_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "drive_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_blasts: {
        Row: {
          audience: string
          audience_filter: Json | null
          body_html: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          recipient_count: number
          sent_count: number
          status: string
          subject: string
        }
        Insert: {
          audience: string
          audience_filter?: Json | null
          body_html: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_count?: number
          status?: string
          subject: string
        }
        Update: {
          audience?: string
          audience_filter?: Json | null
          body_html?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_count?: number
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          blast_id: string | null
          created_at: string
          error: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          recipient_member: string | null
          resend_id: string | null
          retried_at: string | null
          retry_count: number
          sent_by: string | null
          status: string
          subject: string
          template: string
        }
        Insert: {
          blast_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          recipient_member?: string | null
          resend_id?: string | null
          retried_at?: string | null
          retry_count?: number
          sent_by?: string | null
          status?: string
          subject: string
          template: string
        }
        Update: {
          blast_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_member?: string | null
          resend_id?: string | null
          retried_at?: string | null
          retry_count?: number
          sent_by?: string | null
          status?: string
          subject?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_recipient_member_fkey"
            columns: ["recipient_member"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      finzite_scores: {
        Row: {
          avg_net_margin: number | null
          credit_readiness: number | null
          days_inventory: number | null
          health_score: number | null
          id: string
          marketplace: string
          max_loan_zar: number | null
          member_id: string
          return_rate: number | null
          revenue_30d: number | null
          revenue_trend: string | null
          scored_at: string | null
          stock_turnover: number | null
        }
        Insert: {
          avg_net_margin?: number | null
          credit_readiness?: number | null
          days_inventory?: number | null
          health_score?: number | null
          id?: string
          marketplace: string
          max_loan_zar?: number | null
          member_id: string
          return_rate?: number | null
          revenue_30d?: number | null
          revenue_trend?: string | null
          scored_at?: string | null
          stock_turnover?: number | null
        }
        Update: {
          avg_net_margin?: number | null
          credit_readiness?: number | null
          days_inventory?: number | null
          health_score?: number | null
          id?: string
          marketplace?: string
          max_loan_zar?: number | null
          member_id?: string
          return_rate?: number | null
          revenue_30d?: number | null
          revenue_trend?: string | null
          scored_at?: string | null
          stock_turnover?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finzite_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      flame_graphics_usage: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          member_id: string
          prompt: string
          revised_prompt: string | null
          size: string
          style: string | null
          template: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          member_id: string
          prompt: string
          revised_prompt?: string | null
          size: string
          style?: string | null
          template: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          member_id?: string
          prompt?: string
          revised_prompt?: string | null
          size?: string
          style?: string | null
          template?: string
        }
        Relationships: []
      }
      flame_usage: {
        Row: {
          asset_type: string
          created_at: string | null
          id: string
          member_id: string | null
        }
        Insert: {
          asset_type: string
          created_at?: string | null
          id?: string
          member_id?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string | null
          id?: string
          member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flame_usage_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      flame_video_usage: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          image_count: number | null
          kind: string
          member_id: string
          size: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          image_count?: number | null
          kind?: string
          member_id: string
          size: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          image_count?: number | null
          kind?: string
          member_id?: string
          size?: string
          video_url?: string | null
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string
          details: Json | null
          flag_type: string
          id: string
          member_id: string
          resolved_at: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          flag_type: string
          id?: string
          member_id: string
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          flag_type?: string
          id?: string
          member_id?: string
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_scores: {
        Row: {
          breakdown: Json | null
          last_calculated_at: string
          member_id: string
          risk_level: string
          score: number
        }
        Insert: {
          breakdown?: Json | null
          last_calculated_at?: string
          member_id: string
          risk_level?: string
          score?: number
        }
        Update: {
          breakdown?: Json | null
          last_calculated_at?: string
          member_id?: string
          risk_level?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "fraud_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      free_spark_claims: {
        Row: {
          claim_type: string
          claimed_at: string
          expires_at: string | null
          id: string
          member_id: string
          sparks_awarded: number
          status: string
        }
        Insert: {
          claim_type: string
          claimed_at?: string
          expires_at?: string | null
          id?: string
          member_id: string
          sparks_awarded: number
          status?: string
        }
        Update: {
          claim_type?: string
          claimed_at?: string
          expires_at?: string | null
          id?: string
          member_id?: string
          sparks_awarded?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_spark_claims_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_applications: {
        Row: {
          account_number: string
          account_type: string
          agreed: boolean
          amazon_seller_id: string | null
          bank_name: string
          branch_code: string
          created_at: string
          expected_volume: string
          has_amazon: boolean
          has_makro: boolean
          has_takealot: boolean
          id: string
          makro_seller_id: string | null
          member_id: string
          needs_amazon: boolean
          needs_makro: boolean
          needs_takealot: boolean
          other_category: string | null
          product_categories: string[]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          takealot_seller_id: string | null
          updated_at: string
        }
        Insert: {
          account_number: string
          account_type: string
          agreed?: boolean
          amazon_seller_id?: string | null
          bank_name: string
          branch_code: string
          created_at?: string
          expected_volume: string
          has_amazon?: boolean
          has_makro?: boolean
          has_takealot?: boolean
          id?: string
          makro_seller_id?: string | null
          member_id: string
          needs_amazon?: boolean
          needs_makro?: boolean
          needs_takealot?: boolean
          other_category?: string | null
          product_categories?: string[]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          takealot_seller_id?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string
          account_type?: string
          agreed?: boolean
          amazon_seller_id?: string | null
          bank_name?: string
          branch_code?: string
          created_at?: string
          expected_volume?: string
          has_amazon?: boolean
          has_makro?: boolean
          has_takealot?: boolean
          id?: string
          makro_seller_id?: string | null
          member_id?: string
          needs_amazon?: boolean
          needs_makro?: boolean
          needs_takealot?: boolean
          other_category?: string | null
          product_categories?: string[]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          takealot_seller_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fulfillment_config: {
        Row: {
          base_rate: number | null
          created_at: string
          estimated_cost_per_unit: number | null
          handling_fee: number | null
          id: string
          raw_response: Json | null
          roboost_zone: string | null
          updated_at: string
          user_id: string
          weight_surcharge: number | null
        }
        Insert: {
          base_rate?: number | null
          created_at?: string
          estimated_cost_per_unit?: number | null
          handling_fee?: number | null
          id?: string
          raw_response?: Json | null
          roboost_zone?: string | null
          updated_at?: string
          user_id: string
          weight_surcharge?: number | null
        }
        Update: {
          base_rate?: number | null
          created_at?: string
          estimated_cost_per_unit?: number | null
          handling_fee?: number | null
          id?: string
          raw_response?: Json | null
          roboost_zone?: string | null
          updated_at?: string
          user_id?: string
          weight_surcharge?: number | null
        }
        Relationships: []
      }
      fulfillment_inventory: {
        Row: {
          created_at: string
          expected_arrival: string | null
          id: string
          last_restocked_at: string | null
          member_id: string
          product_name: string
          quantity_available: number
          quantity_reserved: number
          quantity_total: number
          sku: string | null
          status: string
          storage_location: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_arrival?: string | null
          id?: string
          last_restocked_at?: string | null
          member_id: string
          product_name: string
          quantity_available?: number
          quantity_reserved?: number
          quantity_total?: number
          sku?: string | null
          status?: string
          storage_location?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_arrival?: string | null
          id?: string
          last_restocked_at?: string | null
          member_id?: string
          product_name?: string
          quantity_available?: number
          quantity_reserved?: number
          quantity_total?: number
          sku?: string | null
          status?: string
          storage_location?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fulfillment_invoices: {
        Row: {
          base_fee: number
          created_at: string
          due_date: string
          handling_count: number
          handling_fees: number
          id: string
          item_fees: number
          large_item_count: number
          medium_item_count: number
          member_id: string
          month: number
          paid_at: string | null
          small_item_count: number
          status: string
          total_amount: number
          updated_at: string
          year: number
        }
        Insert: {
          base_fee?: number
          created_at?: string
          due_date: string
          handling_count?: number
          handling_fees?: number
          id?: string
          item_fees?: number
          large_item_count?: number
          medium_item_count?: number
          member_id: string
          month: number
          paid_at?: string | null
          small_item_count?: number
          status?: string
          total_amount?: number
          updated_at?: string
          year: number
        }
        Update: {
          base_fee?: number
          created_at?: string
          due_date?: string
          handling_count?: number
          handling_fees?: number
          id?: string
          item_fees?: number
          large_item_count?: number
          medium_item_count?: number
          member_id?: string
          month?: number
          paid_at?: string | null
          small_item_count?: number
          status?: string
          total_amount?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      fulfillment_orders: {
        Row: {
          amount: number
          courier: string | null
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_name: string | null
          delivered_at: string | null
          id: string
          member_id: string
          order_number: string
          platform: string
          problem_description: string | null
          problem_type: string | null
          product_name: string
          quantity: number
          shipped_at: string | null
          size_tier: string | null
          sku: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          amount?: number
          courier?: string | null
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          id?: string
          member_id: string
          order_number: string
          platform: string
          problem_description?: string | null
          problem_type?: string | null
          product_name: string
          quantity?: number
          shipped_at?: string | null
          size_tier?: string | null
          sku?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          amount?: number
          courier?: string | null
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          id?: string
          member_id?: string
          order_number?: string
          platform?: string
          problem_description?: string | null
          problem_type?: string | null
          product_name?: string
          quantity?: number
          shipped_at?: string | null
          size_tier?: string | null
          sku?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      fulfillment_shipments: {
        Row: {
          courier: string
          created_at: string
          error: string | null
          id: string
          member_id: string
          payment_reference: string | null
          raw_response: Json | null
          source_id: string
          source_type: string
          status: string
          tracking_url: string | null
          updated_at: string
          waybill_number: string | null
        }
        Insert: {
          courier?: string
          created_at?: string
          error?: string | null
          id?: string
          member_id: string
          payment_reference?: string | null
          raw_response?: Json | null
          source_id: string
          source_type: string
          status?: string
          tracking_url?: string | null
          updated_at?: string
          waybill_number?: string | null
        }
        Update: {
          courier?: string
          created_at?: string
          error?: string | null
          id?: string
          member_id?: string
          payment_reference?: string | null
          raw_response?: Json | null
          source_id?: string
          source_type?: string
          status?: string
          tracking_url?: string | null
          updated_at?: string
          waybill_number?: string | null
        }
        Relationships: []
      }
      fulfillment_subscriptions: {
        Row: {
          activated_at: string
          created_at: string
          id: string
          member_id: string
          monthly_fee: number
          next_billing_date: string
          status: string
          suspended_at: string | null
          updated_at: string
          warehouse_address: string | null
        }
        Insert: {
          activated_at?: string
          created_at?: string
          id?: string
          member_id: string
          monthly_fee?: number
          next_billing_date?: string
          status?: string
          suspended_at?: string | null
          updated_at?: string
          warehouse_address?: string | null
        }
        Update: {
          activated_at?: string
          created_at?: string
          id?: string
          member_id?: string
          monthly_fee?: number
          next_billing_date?: string
          status?: string
          suspended_at?: string | null
          updated_at?: string
          warehouse_address?: string | null
        }
        Relationships: []
      }
      game_results: {
        Row: {
          bet_amount: number
          created_at: string
          game_type: string
          id: string
          member_id: string
          outcome: string
          spark_type: string
          won_amount: number
        }
        Insert: {
          bet_amount: number
          created_at?: string
          game_type: string
          id?: string
          member_id: string
          outcome: string
          spark_type: string
          won_amount?: number
        }
        Update: {
          bet_amount?: number
          created_at?: string
          game_type?: string
          id?: string
          member_id?: string
          outcome?: string
          spark_type?: string
          won_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_results_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      group_buy_participants: {
        Row: {
          group_buy_id: string | null
          id: string
          joined_at: string | null
          member_id: string | null
          payment_reference: string | null
          payment_status: string | null
          quantity: number
          total_price_zar: number
          unit_price_zar: number
        }
        Insert: {
          group_buy_id?: string | null
          id?: string
          joined_at?: string | null
          member_id?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          quantity: number
          total_price_zar: number
          unit_price_zar: number
        }
        Update: {
          group_buy_id?: string | null
          id?: string
          joined_at?: string | null
          member_id?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          quantity?: number
          total_price_zar?: number
          unit_price_zar?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_buy_participants_group_buy_id_fkey"
            columns: ["group_buy_id"]
            isOneToOne: false
            referencedRelation: "group_buys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_buy_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      group_buys: {
        Row: {
          admin_id: string | null
          closes_at: string | null
          created_at: string | null
          current_quantity: number | null
          group_price_zar: number
          id: string
          moq: number | null
          ordered_at: string | null
          product_id: string | null
          product_name: string
          status: string | null
          supplier_name: string | null
          supplier_url: string | null
          target_quantity: number
          unit_price_zar: number
        }
        Insert: {
          admin_id?: string | null
          closes_at?: string | null
          created_at?: string | null
          current_quantity?: number | null
          group_price_zar: number
          id?: string
          moq?: number | null
          ordered_at?: string | null
          product_id?: string | null
          product_name: string
          status?: string | null
          supplier_name?: string | null
          supplier_url?: string | null
          target_quantity: number
          unit_price_zar: number
        }
        Update: {
          admin_id?: string | null
          closes_at?: string | null
          created_at?: string | null
          current_quantity?: number | null
          group_price_zar?: number
          id?: string
          moq?: number | null
          ordered_at?: string | null
          product_id?: string | null
          product_name?: string
          status?: string | null
          supplier_name?: string | null
          supplier_url?: string | null
          target_quantity?: number
          unit_price_zar?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_buys_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_buys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trending_products"
            referencedColumns: ["id"]
          },
        ]
      }
      health_snapshots: {
        Row: {
          active_bids: number | null
          health_score: number | null
          id: string
          inflow_24h: number | null
          obligations: number | null
          paused: boolean | null
          payout_due: number | null
          snapped_at: string | null
          tier: string
          vault_bids: number | null
        }
        Insert: {
          active_bids?: number | null
          health_score?: number | null
          id?: string
          inflow_24h?: number | null
          obligations?: number | null
          paused?: boolean | null
          payout_due?: number | null
          snapped_at?: string | null
          tier: string
          vault_bids?: number | null
        }
        Update: {
          active_bids?: number | null
          health_score?: number | null
          id?: string
          inflow_24h?: number | null
          obligations?: number | null
          paused?: boolean | null
          payout_due?: number | null
          snapped_at?: string | null
          tier?: string
          vault_bids?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_snapshots_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "circle_tiers"
            referencedColumns: ["tier"]
          },
        ]
      }
      import_finance_apps: {
        Row: {
          created_at: string | null
          decision_at: string | null
          finzite_score: number | null
          id: string
          loan_amount: number
          member_id: string
          order_id: string
          origination_fee: number
          status: string | null
        }
        Insert: {
          created_at?: string | null
          decision_at?: string | null
          finzite_score?: number | null
          id?: string
          loan_amount: number
          member_id: string
          order_id: string
          origination_fee: number
          status?: string | null
        }
        Update: {
          created_at?: string | null
          decision_at?: string | null
          finzite_score?: number | null
          id?: string
          loan_amount?: number
          member_id?: string
          order_id?: string
          origination_fee?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_finance_apps_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_finance_apps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "st_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_cases: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          member_id: string
          opened_reason: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          member_id: string
          opened_reason?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          member_id?: string
          opened_reason?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_cases_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      market_listings: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_verified: boolean | null
          member_id: string
          price_fiat: number | null
          price_sparks: number | null
          rating_avg: number | null
          rating_count: number | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_verified?: boolean | null
          member_id: string
          price_fiat?: number | null
          price_sparks?: number | null
          rating_avg?: number | null
          rating_count?: number | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_verified?: boolean | null
          member_id?: string
          price_fiat?: number | null
          price_sparks?: number | null
          rating_avg?: number | null
          rating_count?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      market_txns: {
        Row: {
          amount: number
          buyer_id: string
          commission: number | null
          created_at: string | null
          currency: string | null
          id: string
          listing_id: string
          rating: number | null
          review: string | null
          seller_id: string
          status: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          commission?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          listing_id: string
          rating?: number | null
          review?: string | null
          seller_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          commission?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          listing_id?: string
          rating?: number | null
          review?: string | null
          seller_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_txns_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_txns_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_txns_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_banking_details: {
        Row: {
          account_holder_name: string
          account_number: string
          account_type: string | null
          bank_name: string
          branch_code: string | null
          created_at: string
          id: string
          member_id: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          account_holder_name: string
          account_number: string
          account_type?: string | null
          bank_name: string
          branch_code?: string | null
          created_at?: string
          id?: string
          member_id: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          account_type?: string | null
          bank_name?: string
          branch_code?: string | null
          created_at?: string
          id?: string
          member_id?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "member_banking_details_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_generated_videos: {
        Row: {
          avatar_id: string | null
          caption: string | null
          created_at: string
          download_count: number
          error_message: string | null
          generation_status: string
          heygen_video_id: string | null
          id: string
          member_id: string
          referral_code: string | null
          referral_link: string | null
          script_id: string | null
          script_text: string
          share_count: number
          signups_attributed: number
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
          view_count: number
        }
        Insert: {
          avatar_id?: string | null
          caption?: string | null
          created_at?: string
          download_count?: number
          error_message?: string | null
          generation_status?: string
          heygen_video_id?: string | null
          id?: string
          member_id: string
          referral_code?: string | null
          referral_link?: string | null
          script_id?: string | null
          script_text: string
          share_count?: number
          signups_attributed?: number
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Update: {
          avatar_id?: string | null
          caption?: string | null
          created_at?: string
          download_count?: number
          error_message?: string | null
          generation_status?: string
          heygen_video_id?: string | null
          id?: string
          member_id?: string
          referral_code?: string | null
          referral_link?: string | null
          script_id?: string | null
          script_text?: string
          share_count?: number
          signups_attributed?: number
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_generated_videos_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "ai_avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_generated_videos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_generated_videos_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      member_product_tracking: {
        Row: {
          created_at: string | null
          id: string
          member_id: string | null
          notes: string | null
          notify_on_sa_available: boolean | null
          notify_on_supplier_found: boolean | null
          product_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          notify_on_sa_available?: boolean | null
          notify_on_supplier_found?: boolean | null
          product_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          notify_on_sa_available?: boolean | null
          notify_on_supplier_found?: boolean | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_product_tracking_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_product_tracking_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trending_products"
            referencedColumns: ["id"]
          },
        ]
      }
      member_purchase_requirements: {
        Row: {
          access_revoked_at: string | null
          compliance_status: string | null
          created_at: string | null
          current_month_spend: number | null
          current_month_units: number | null
          id: string
          last_purchase_at: string | null
          member_id: string | null
          min_monthly_spend: number
          min_monthly_units: number | null
          next_review_date: string | null
          tier: string | null
          warning_sent_at: string | null
        }
        Insert: {
          access_revoked_at?: string | null
          compliance_status?: string | null
          created_at?: string | null
          current_month_spend?: number | null
          current_month_units?: number | null
          id?: string
          last_purchase_at?: string | null
          member_id?: string | null
          min_monthly_spend: number
          min_monthly_units?: number | null
          next_review_date?: string | null
          tier?: string | null
          warning_sent_at?: string | null
        }
        Update: {
          access_revoked_at?: string | null
          compliance_status?: string | null
          created_at?: string | null
          current_month_spend?: number | null
          current_month_units?: number | null
          id?: string
          last_purchase_at?: string | null
          member_id?: string | null
          min_monthly_spend?: number
          min_monthly_units?: number | null
          next_review_date?: string | null
          tier?: string | null
          warning_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_purchase_requirements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_purchases: {
        Row: {
          admin_notes: string | null
          delivered_at: string | null
          group_buy_id: string | null
          id: string
          member_id: string | null
          order_status: string | null
          payment_reference: string | null
          payment_status: string | null
          product_id: string | null
          product_name: string
          product_source: string | null
          purchased_at: string | null
          quantity: number
          supplier: string | null
          total_price_zar: number
          unit_price_zar: number
        }
        Insert: {
          admin_notes?: string | null
          delivered_at?: string | null
          group_buy_id?: string | null
          id?: string
          member_id?: string | null
          order_status?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          product_id?: string | null
          product_name: string
          product_source?: string | null
          purchased_at?: string | null
          quantity: number
          supplier?: string | null
          total_price_zar: number
          unit_price_zar: number
        }
        Update: {
          admin_notes?: string | null
          delivered_at?: string | null
          group_buy_id?: string | null
          id?: string
          member_id?: string | null
          order_status?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          product_id?: string | null
          product_name?: string
          product_source?: string | null
          purchased_at?: string | null
          quantity?: number
          supplier?: string | null
          total_price_zar?: number
          unit_price_zar?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_purchases_group_buy_id_fkey"
            columns: ["group_buy_id"]
            isOneToOne: false
            referencedRelation: "group_buys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_purchases_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_ugc_submissions: {
        Row: {
          admin_notes: string | null
          caption_used: string | null
          created_at: string
          id: string
          member_id: string
          platform: string
          reviewed_at: string | null
          reviewed_by: string | null
          rewarded_at: string | null
          social_media_link: string
          sparks_rewarded: number
          submission_status: string
          video_path: string | null
          video_url: string
        }
        Insert: {
          admin_notes?: string | null
          caption_used?: string | null
          created_at?: string
          id?: string
          member_id: string
          platform: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rewarded_at?: string | null
          social_media_link: string
          sparks_rewarded?: number
          submission_status?: string
          video_path?: string | null
          video_url: string
        }
        Update: {
          admin_notes?: string | null
          caption_used?: string | null
          created_at?: string
          id?: string
          member_id?: string
          platform?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rewarded_at?: string | null
          social_media_link?: string
          sparks_rewarded?: number
          submission_status?: string
          video_path?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_ugc_submissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ugc_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_video_shares: {
        Row: {
          caption_used: string | null
          created_at: string
          id: string
          member_id: string
          platform: string
          referrals_generated: number
          shared_at: string
          video_id: string
          views_tracked: number
        }
        Insert: {
          caption_used?: string | null
          created_at?: string
          id?: string
          member_id: string
          platform?: string
          referrals_generated?: number
          shared_at?: string
          video_id: string
          views_tracked?: number
        }
        Update: {
          caption_used?: string | null
          created_at?: string
          id?: string
          member_id?: string
          platform?: string
          referrals_generated?: number
          shared_at?: string
          video_id?: string
          views_tracked?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_video_shares_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_video_shares_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          age_verified: boolean
          age_verified_at: string | null
          bank_account: string | null
          bank_branch: string | null
          bank_name: string | null
          bid_boost_score: number
          buyers_club_amount: number | null
          buyers_club_approved_at: string | null
          buyers_club_payment_method: string | null
          buyers_club_proof_url: string | null
          buyers_club_rejection_reason: string | null
          buyers_club_renewal_at: string | null
          buyers_club_started_at: string | null
          buyers_club_status: string | null
          buyers_club_submitted_at: string | null
          buyers_club_tier: string | null
          city: string | null
          community_score: number
          consistency_score: number
          contribution_volume_score: number
          country: string | null
          country_code: string
          created_at: string | null
          currency_code: string
          document_number: string | null
          document_type: string | null
          dream_goal: string | null
          email: string | null
          email_preferences: Json
          first_contribution_at: string | null
          force_password_change: boolean
          fulfillment_partner_available: boolean | null
          full_name: string
          has_buyers_club_access: boolean
          has_contributed: boolean
          id: string
          id_number: string | null
          is_active: boolean | null
          is_international: boolean | null
          kyc_document_url: string | null
          kyc_last_reminder_at: string | null
          kyc_level: number
          kyc_override_by: string | null
          kyc_override_reason: string | null
          kyc_photo_url: string | null
          kyc_referral_bonus_paid: boolean
          kyc_rejection_reason: string | null
          kyc_reminder_count: number
          kyc_status: string | null
          kyc_submitted_at: string | null
          kyc_verified_at: string | null
          last_password_changed: string | null
          last_seen_at: string | null
          marketplace_preference: Json | null
          password_reset_at: string | null
          password_reset_by: string | null
          paystack_customer_code: string | null
          paystack_plan_code: string | null
          paystack_reference: string | null
          paystack_subscription_code: string | null
          phone: string
          phone_verified: boolean
          postal_code: string | null
          priority_score: number
          promo_unlock_at: string | null
          promo_unlock_bonus_sparks: number
          promo_unlock_circle_id: string | null
          promotional_sparks_unlocked: boolean
          province: string | null
          rank: string | null
          referral_code: string | null
          referred_by: string | null
          referred_by_code: string | null
          spark_link_code: string | null
          spark_trade_avg_order_value: number | null
          spark_trade_business_type: string | null
          spark_trade_capital: number | null
          spark_trade_group_buy_interest: boolean | null
          spark_trade_income_goal: number | null
          spark_trade_income_path: string | null
          spark_trade_last_purchase_date: string | null
          spark_trade_lifetime_value: number | null
          spark_trade_marketplace_experience: string | null
          spark_trade_onboarding_complete: boolean | null
          spark_trade_onboarding_completed_at: string | null
          spark_trade_paystack_reference: string | null
          spark_trade_purchased_from: string | null
          spark_trade_referral_count: number | null
          spark_trade_service_area: string | null
          spark_trade_stock_preference: string | null
          spark_trade_subscription_paid_at: string | null
          spark_trade_subscription_payment_status: string | null
          spark_trade_subscription_tier: string | null
          spark_trade_total_purchases: number | null
          status: string
          streak_count: number | null
          time_waiting_score: number
          total_cycles: number | null
          tour_banner_dismissed_at: string | null
          usdt_wallet_trc20: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          age_verified?: boolean
          age_verified_at?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bid_boost_score?: number
          buyers_club_amount?: number | null
          buyers_club_approved_at?: string | null
          buyers_club_payment_method?: string | null
          buyers_club_proof_url?: string | null
          buyers_club_rejection_reason?: string | null
          buyers_club_renewal_at?: string | null
          buyers_club_started_at?: string | null
          buyers_club_status?: string | null
          buyers_club_submitted_at?: string | null
          buyers_club_tier?: string | null
          city?: string | null
          community_score?: number
          consistency_score?: number
          contribution_volume_score?: number
          country?: string | null
          country_code?: string
          created_at?: string | null
          currency_code?: string
          document_number?: string | null
          document_type?: string | null
          dream_goal?: string | null
          email?: string | null
          email_preferences?: Json
          first_contribution_at?: string | null
          force_password_change?: boolean
          fulfillment_partner_available?: boolean | null
          full_name: string
          has_buyers_club_access?: boolean
          has_contributed?: boolean
          id?: string
          id_number?: string | null
          is_active?: boolean | null
          is_international?: boolean | null
          kyc_document_url?: string | null
          kyc_last_reminder_at?: string | null
          kyc_level?: number
          kyc_override_by?: string | null
          kyc_override_reason?: string | null
          kyc_photo_url?: string | null
          kyc_referral_bonus_paid?: boolean
          kyc_rejection_reason?: string | null
          kyc_reminder_count?: number
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_password_changed?: string | null
          last_seen_at?: string | null
          marketplace_preference?: Json | null
          password_reset_at?: string | null
          password_reset_by?: string | null
          paystack_customer_code?: string | null
          paystack_plan_code?: string | null
          paystack_reference?: string | null
          paystack_subscription_code?: string | null
          phone: string
          phone_verified?: boolean
          postal_code?: string | null
          priority_score?: number
          promo_unlock_at?: string | null
          promo_unlock_bonus_sparks?: number
          promo_unlock_circle_id?: string | null
          promotional_sparks_unlocked?: boolean
          province?: string | null
          rank?: string | null
          referral_code?: string | null
          referred_by?: string | null
          referred_by_code?: string | null
          spark_link_code?: string | null
          spark_trade_avg_order_value?: number | null
          spark_trade_business_type?: string | null
          spark_trade_capital?: number | null
          spark_trade_group_buy_interest?: boolean | null
          spark_trade_income_goal?: number | null
          spark_trade_income_path?: string | null
          spark_trade_last_purchase_date?: string | null
          spark_trade_lifetime_value?: number | null
          spark_trade_marketplace_experience?: string | null
          spark_trade_onboarding_complete?: boolean | null
          spark_trade_onboarding_completed_at?: string | null
          spark_trade_paystack_reference?: string | null
          spark_trade_purchased_from?: string | null
          spark_trade_referral_count?: number | null
          spark_trade_service_area?: string | null
          spark_trade_stock_preference?: string | null
          spark_trade_subscription_paid_at?: string | null
          spark_trade_subscription_payment_status?: string | null
          spark_trade_subscription_tier?: string | null
          spark_trade_total_purchases?: number | null
          status?: string
          streak_count?: number | null
          time_waiting_score?: number
          total_cycles?: number | null
          tour_banner_dismissed_at?: string | null
          usdt_wallet_trc20?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          age_verified?: boolean
          age_verified_at?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bid_boost_score?: number
          buyers_club_amount?: number | null
          buyers_club_approved_at?: string | null
          buyers_club_payment_method?: string | null
          buyers_club_proof_url?: string | null
          buyers_club_rejection_reason?: string | null
          buyers_club_renewal_at?: string | null
          buyers_club_started_at?: string | null
          buyers_club_status?: string | null
          buyers_club_submitted_at?: string | null
          buyers_club_tier?: string | null
          city?: string | null
          community_score?: number
          consistency_score?: number
          contribution_volume_score?: number
          country?: string | null
          country_code?: string
          created_at?: string | null
          currency_code?: string
          document_number?: string | null
          document_type?: string | null
          dream_goal?: string | null
          email?: string | null
          email_preferences?: Json
          first_contribution_at?: string | null
          force_password_change?: boolean
          fulfillment_partner_available?: boolean | null
          full_name?: string
          has_buyers_club_access?: boolean
          has_contributed?: boolean
          id?: string
          id_number?: string | null
          is_active?: boolean | null
          is_international?: boolean | null
          kyc_document_url?: string | null
          kyc_last_reminder_at?: string | null
          kyc_level?: number
          kyc_override_by?: string | null
          kyc_override_reason?: string | null
          kyc_photo_url?: string | null
          kyc_referral_bonus_paid?: boolean
          kyc_rejection_reason?: string | null
          kyc_reminder_count?: number
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_password_changed?: string | null
          last_seen_at?: string | null
          marketplace_preference?: Json | null
          password_reset_at?: string | null
          password_reset_by?: string | null
          paystack_customer_code?: string | null
          paystack_plan_code?: string | null
          paystack_reference?: string | null
          paystack_subscription_code?: string | null
          phone?: string
          phone_verified?: boolean
          postal_code?: string | null
          priority_score?: number
          promo_unlock_at?: string | null
          promo_unlock_bonus_sparks?: number
          promo_unlock_circle_id?: string | null
          promotional_sparks_unlocked?: boolean
          province?: string | null
          rank?: string | null
          referral_code?: string | null
          referred_by?: string | null
          referred_by_code?: string | null
          spark_link_code?: string | null
          spark_trade_avg_order_value?: number | null
          spark_trade_business_type?: string | null
          spark_trade_capital?: number | null
          spark_trade_group_buy_interest?: boolean | null
          spark_trade_income_goal?: number | null
          spark_trade_income_path?: string | null
          spark_trade_last_purchase_date?: string | null
          spark_trade_lifetime_value?: number | null
          spark_trade_marketplace_experience?: string | null
          spark_trade_onboarding_complete?: boolean | null
          spark_trade_onboarding_completed_at?: string | null
          spark_trade_paystack_reference?: string | null
          spark_trade_purchased_from?: string | null
          spark_trade_referral_count?: number | null
          spark_trade_service_area?: string | null
          spark_trade_stock_preference?: string | null
          spark_trade_subscription_paid_at?: string | null
          spark_trade_subscription_payment_status?: string | null
          spark_trade_subscription_tier?: string | null
          spark_trade_total_purchases?: number | null
          status?: string
          streak_count?: number | null
          time_waiting_score?: number
          total_cycles?: number | null
          tour_banner_dismissed_at?: string | null
          usdt_wallet_trc20?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_promo_unlock_circle_id_fkey"
            columns: ["promo_unlock_circle_id"]
            isOneToOne: false
            referencedRelation: "circle_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      modular_models: {
        Row: {
          assembly_weeks: number
          base_price_zar: number
          bathrooms: number
          bedrooms: number
          created_at: string
          delivery_weeks: number
          description: string | null
          floor_plan_url: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_plot_sqm: number | null
          name: string
          size_sqm: number
          supplier: string | null
        }
        Insert: {
          assembly_weeks?: number
          base_price_zar: number
          bathrooms: number
          bedrooms: number
          created_at?: string
          delivery_weeks?: number
          description?: string | null
          floor_plan_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_plot_sqm?: number | null
          name: string
          size_sqm: number
          supplier?: string | null
        }
        Update: {
          assembly_weeks?: number
          base_price_zar?: number
          bathrooms?: number
          bedrooms?: number
          created_at?: string
          delivery_weeks?: number
          description?: string | null
          floor_plan_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_plot_sqm?: number | null
          name?: string
          size_sqm?: number
          supplier?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          kind: string | null
          link: string | null
          member_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          kind?: string | null
          link?: string | null
          member_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          kind?: string | null
          link?: string | null
          member_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: []
      }
      paystack_events: {
        Row: {
          created_at: string
          error: string | null
          event: string
          id: string
          member_id: string | null
          processed: boolean
          raw: Json
          reference: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: string
          id?: string
          member_id?: string | null
          processed?: boolean
          raw: Json
          reference?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          member_id?: string | null
          processed?: boolean
          raw?: Json
          reference?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          branch_code: string | null
          created_at: string
          crypto_enabled: boolean
          growth_override_open: boolean
          harvest_override_open: boolean
          id: string
          override_expires_at: string | null
          payment_instructions: string | null
          payouts_growth: number
          payouts_harvest: number
          payouts_seed: number
          seed_override_open: boolean
          updated_at: string
          updated_by: string | null
          usdt_trc20_address: string | null
          usdt_zar_rate: number | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch_code?: string | null
          created_at?: string
          crypto_enabled?: boolean
          growth_override_open?: boolean
          harvest_override_open?: boolean
          id?: string
          override_expires_at?: string | null
          payment_instructions?: string | null
          payouts_growth?: number
          payouts_harvest?: number
          payouts_seed?: number
          seed_override_open?: boolean
          updated_at?: string
          updated_by?: string | null
          usdt_trc20_address?: string | null
          usdt_zar_rate?: number | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch_code?: string | null
          created_at?: string
          crypto_enabled?: boolean
          growth_override_open?: boolean
          harvest_override_open?: boolean
          id?: string
          override_expires_at?: string | null
          payment_instructions?: string | null
          payouts_growth?: number
          payouts_harvest?: number
          payouts_seed?: number
          seed_override_open?: boolean
          updated_at?: string
          updated_by?: string | null
          usdt_trc20_address?: string | null
          usdt_zar_rate?: number | null
        }
        Relationships: []
      }
      podcast_analytics: {
        Row: {
          action: string
          created_at: string
          episode_id: string
          id: string
          percentage_completed: number | null
          seconds_listened: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          episode_id: string
          id?: string
          percentage_completed?: number | null
          seconds_listened?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          episode_id?: string
          id?: string
          percentage_completed?: number | null
          seconds_listened?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_analytics_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_episodes: {
        Row: {
          audio_url: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string
          duration_seconds: number | null
          episode_number: number | null
          id: string
          play_count: number
          published_at: string | null
          related_links_json: Json
          status: string
          takeaways: string[]
          timestamps_json: Json
          title: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          duration_seconds?: number | null
          episode_number?: number | null
          id?: string
          play_count?: number
          published_at?: string | null
          related_links_json?: Json
          status?: string
          takeaways?: string[]
          timestamps_json?: Json
          title: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          duration_seconds?: number | null
          episode_number?: number | null
          id?: string
          play_count?: number
          published_at?: string | null
          related_links_json?: Json
          status?: string
          takeaways?: string[]
          timestamps_json?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      predictor_entries: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean | null
          member_id: string | null
          question_id: string | null
          selected_answer: string | null
          sparks_spent: number | null
          sparks_won: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          member_id?: string | null
          question_id?: string | null
          selected_answer?: string | null
          sparks_spent?: number | null
          sparks_won?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          member_id?: string | null
          question_id?: string | null
          selected_answer?: string | null
          sparks_spent?: number | null
          sparks_won?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "predictor_entries_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "predictor_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictor_questions: {
        Row: {
          category: string | null
          closes_at: string | null
          correct_answer: string | null
          created_at: string | null
          id: string
          options: Json | null
          question: string
          sparks_cost: number | null
          sparks_reward: number | null
          status: string | null
        }
        Insert: {
          category?: string | null
          closes_at?: string | null
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          options?: Json | null
          question: string
          sparks_cost?: number | null
          sparks_reward?: number | null
          status?: string | null
        }
        Update: {
          category?: string | null
          closes_at?: string | null
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          options?: Json | null
          question?: string
          sparks_cost?: number | null
          sparks_reward?: number | null
          status?: string | null
        }
        Relationships: []
      }
      product_discovery: {
        Row: {
          alibaba_product_url: string | null
          alibaba_supplier_name: string | null
          alibaba_supplier_rating: number | null
          amazon_price_zar: number | null
          amazon_product_url: string | null
          amazon_rating: number | null
          amazon_reviews_count: number | null
          backend_id: number | null
          category: string | null
          china_api_price_zar: number | null
          created_at: string | null
          data_validation_status: string | null
          date_published: string | null
          date_sent_to_supplier: string | null
          date_supplier_responded: string | null
          demand_score: number | null
          estimated_margin_pct: number | null
          final_moq: number | null
          final_supplier_price_zar: number | null
          id: number
          is_published: boolean | null
          lead_time_days: number | null
          product_name: string
          source: string | null
          status: string | null
          supplier_response_notes: string | null
          takealot_price_zar: number | null
          takealot_product_url: string | null
          takealot_rating: number | null
          takealot_reviews_count: number | null
          updated_at: string | null
          validation_notes: string | null
        }
        Insert: {
          alibaba_product_url?: string | null
          alibaba_supplier_name?: string | null
          alibaba_supplier_rating?: number | null
          amazon_price_zar?: number | null
          amazon_product_url?: string | null
          amazon_rating?: number | null
          amazon_reviews_count?: number | null
          backend_id?: number | null
          category?: string | null
          china_api_price_zar?: number | null
          created_at?: string | null
          data_validation_status?: string | null
          date_published?: string | null
          date_sent_to_supplier?: string | null
          date_supplier_responded?: string | null
          demand_score?: number | null
          estimated_margin_pct?: number | null
          final_moq?: number | null
          final_supplier_price_zar?: number | null
          id?: number
          is_published?: boolean | null
          lead_time_days?: number | null
          product_name: string
          source?: string | null
          status?: string | null
          supplier_response_notes?: string | null
          takealot_price_zar?: number | null
          takealot_product_url?: string | null
          takealot_rating?: number | null
          takealot_reviews_count?: number | null
          updated_at?: string | null
          validation_notes?: string | null
        }
        Update: {
          alibaba_product_url?: string | null
          alibaba_supplier_name?: string | null
          alibaba_supplier_rating?: number | null
          amazon_price_zar?: number | null
          amazon_product_url?: string | null
          amazon_rating?: number | null
          amazon_reviews_count?: number | null
          backend_id?: number | null
          category?: string | null
          china_api_price_zar?: number | null
          created_at?: string | null
          data_validation_status?: string | null
          date_published?: string | null
          date_sent_to_supplier?: string | null
          date_supplier_responded?: string | null
          demand_score?: number | null
          estimated_margin_pct?: number | null
          final_moq?: number | null
          final_supplier_price_zar?: number | null
          id?: number
          is_published?: boolean | null
          lead_time_days?: number | null
          product_name?: string
          source?: string | null
          status?: string | null
          supplier_response_notes?: string | null
          takealot_price_zar?: number | null
          takealot_product_url?: string | null
          takealot_rating?: number | null
          takealot_reviews_count?: number | null
          updated_at?: string | null
          validation_notes?: string | null
        }
        Relationships: []
      }
      product_feeds: {
        Row: {
          ai_confidence: number | null
          ai_score: number | null
          category: string | null
          country: string
          created_at: string
          id: string
          image_url: string | null
          local_competition_count: number | null
          local_marketplace: string | null
          local_retail_price: number | null
          local_search_volume: number | null
          monthly_search_volume: number | null
          moq: number | null
          product_id: string
          product_name: string
          recommendation: string | null
          stock_available: number | null
          supplier_cost: number | null
          tier: string | null
          trend_direction: string | null
          trend_percentage: number | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_score?: number | null
          category?: string | null
          country: string
          created_at?: string
          id?: string
          image_url?: string | null
          local_competition_count?: number | null
          local_marketplace?: string | null
          local_retail_price?: number | null
          local_search_volume?: number | null
          monthly_search_volume?: number | null
          moq?: number | null
          product_id?: string
          product_name: string
          recommendation?: string | null
          stock_available?: number | null
          supplier_cost?: number | null
          tier?: string | null
          trend_direction?: string | null
          trend_percentage?: number | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_score?: number | null
          category?: string | null
          country?: string
          created_at?: string
          id?: string
          image_url?: string | null
          local_competition_count?: number | null
          local_marketplace?: string | null
          local_retail_price?: number | null
          local_search_volume?: number | null
          monthly_search_volume?: number | null
          moq?: number | null
          product_id?: string
          product_name?: string
          recommendation?: string | null
          stock_available?: number | null
          supplier_cost?: number | null
          tier?: string | null
          trend_direction?: string | null
          trend_percentage?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      product_memberships: {
        Row: {
          amount_local_currency: number | null
          amount_paid_zar: number | null
          created_at: string
          id: string
          local_currency_code: string | null
          membership_start_date: string
          next_payment_date: string | null
          payment_status: string | null
          paystack_reference: string | null
          product: string
          quarantine_reason: string | null
          quarantined_at: string | null
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_local_currency?: number | null
          amount_paid_zar?: number | null
          created_at?: string
          id?: string
          local_currency_code?: string | null
          membership_start_date?: string
          next_payment_date?: string | null
          payment_status?: string | null
          paystack_reference?: string | null
          product: string
          quarantine_reason?: string | null
          quarantined_at?: string | null
          status?: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_local_currency?: number | null
          amount_paid_zar?: number | null
          created_at?: string
          id?: string
          local_currency_code?: string | null
          membership_start_date?: string
          next_payment_date?: string | null
          payment_status?: string | null
          paystack_reference?: string | null
          product?: string
          quarantine_reason?: string | null
          quarantined_at?: string | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          asin: string
          category: string
          competition_level: string | null
          created_at: string
          id: string
          image_url: string | null
          marketplace: string | null
          monthly_rank: number | null
          price_usd: number | null
          price_zar: number | null
          product_url: string | null
          profit_potential: string | null
          rating: number | null
          region: string | null
          related_keywords: Json | null
          review_count: number | null
          reviewed_at: string | null
          sales_rank: number | null
          sales_rank_category: string | null
          search_volume: number | null
          seller_count: number | null
          title: string
          validation_status: string | null
        }
        Insert: {
          asin: string
          category: string
          competition_level?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          marketplace?: string | null
          monthly_rank?: number | null
          price_usd?: number | null
          price_zar?: number | null
          product_url?: string | null
          profit_potential?: string | null
          rating?: number | null
          region?: string | null
          related_keywords?: Json | null
          review_count?: number | null
          reviewed_at?: string | null
          sales_rank?: number | null
          sales_rank_category?: string | null
          search_volume?: number | null
          seller_count?: number | null
          title: string
          validation_status?: string | null
        }
        Update: {
          asin?: string
          category?: string
          competition_level?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          marketplace?: string | null
          monthly_rank?: number | null
          price_usd?: number | null
          price_zar?: number | null
          product_url?: string | null
          profit_potential?: string | null
          rating?: number | null
          region?: string | null
          related_keywords?: Json | null
          review_count?: number | null
          reviewed_at?: string | null
          sales_rank?: number | null
          sales_rank_category?: string | null
          search_volume?: number | null
          seller_count?: number | null
          title?: string
          validation_status?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          assembly_complete_date: string | null
          assembly_cost: number | null
          bathrooms: number | null
          bedrooms: number | null
          connection_cost: number | null
          contingency_cost: number | null
          created_at: string | null
          delivery_date: string | null
          description: string | null
          expected_monthly_rental: number | null
          funding_deadline: string | null
          gallery_urls: Json | null
          home_cost: number | null
          home_order_date: string | null
          id: string
          image_url: string | null
          land_cost: number | null
          location: string
          modular_model: string | null
          modular_supplier: string | null
          name: string
          plot_size_sqm: number | null
          project_stage: string | null
          projected_return_pct: number | null
          property_kind: string
          property_type: string
          raised_amount: number | null
          site_prep_cost: number | null
          size_sqm: number | null
          status: string | null
          supplier_info: Json | null
          target_amount: number
          tenant_ready_date: string | null
          title_deed_number: string | null
          title_deed_url: string | null
          unit_price: number
        }
        Insert: {
          assembly_complete_date?: string | null
          assembly_cost?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          connection_cost?: number | null
          contingency_cost?: number | null
          created_at?: string | null
          delivery_date?: string | null
          description?: string | null
          expected_monthly_rental?: number | null
          funding_deadline?: string | null
          gallery_urls?: Json | null
          home_cost?: number | null
          home_order_date?: string | null
          id?: string
          image_url?: string | null
          land_cost?: number | null
          location: string
          modular_model?: string | null
          modular_supplier?: string | null
          name: string
          plot_size_sqm?: number | null
          project_stage?: string | null
          projected_return_pct?: number | null
          property_kind?: string
          property_type: string
          raised_amount?: number | null
          site_prep_cost?: number | null
          size_sqm?: number | null
          status?: string | null
          supplier_info?: Json | null
          target_amount: number
          tenant_ready_date?: string | null
          title_deed_number?: string | null
          title_deed_url?: string | null
          unit_price?: number
        }
        Update: {
          assembly_complete_date?: string | null
          assembly_cost?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          connection_cost?: number | null
          contingency_cost?: number | null
          created_at?: string | null
          delivery_date?: string | null
          description?: string | null
          expected_monthly_rental?: number | null
          funding_deadline?: string | null
          gallery_urls?: Json | null
          home_cost?: number | null
          home_order_date?: string | null
          id?: string
          image_url?: string | null
          land_cost?: number | null
          location?: string
          modular_model?: string | null
          modular_supplier?: string | null
          name?: string
          plot_size_sqm?: number | null
          project_stage?: string | null
          projected_return_pct?: number | null
          property_kind?: string
          property_type?: string
          raised_amount?: number | null
          site_prep_cost?: number | null
          size_sqm?: number | null
          status?: string | null
          supplier_info?: Json | null
          target_amount?: number
          tenant_ready_date?: string | null
          title_deed_number?: string | null
          title_deed_url?: string | null
          unit_price?: number
        }
        Relationships: []
      }
      property_fund: {
        Row: {
          amount: number
          contribution_type: string | null
          created_at: string | null
          id: string
          member_id: string
          status: string | null
        }
        Insert: {
          amount: number
          contribution_type?: string | null
          created_at?: string | null
          id?: string
          member_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          contribution_type?: string | null
          created_at?: string | null
          id?: string
          member_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_fund_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      property_milestones: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_complete: boolean
          occurred_at: string
          property_id: string
          stage: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_complete?: boolean
          occurred_at?: string
          property_id: string
          stage: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_complete?: boolean
          occurred_at?: string
          property_id?: string
          stage?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_milestones_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requirement_settings: {
        Row: {
          auto_enforce: boolean | null
          created_at: string | null
          grace_period_days: number | null
          id: string
          min_monthly_spend: number
          min_monthly_units: number | null
          suspension_duration_days: number | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          auto_enforce?: boolean | null
          created_at?: string | null
          grace_period_days?: number | null
          id?: string
          min_monthly_spend: number
          min_monthly_units?: number | null
          suspension_duration_days?: number | null
          tier: string
          updated_at?: string | null
        }
        Update: {
          auto_enforce?: boolean | null
          created_at?: string | null
          grace_period_days?: number | null
          id?: string
          min_monthly_spend?: number
          min_monthly_units?: number | null
          suspension_duration_days?: number | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          member_id: string | null
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          member_id?: string | null
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          member_id?: string | null
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      reit_units: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          id: string
          member_id: string
          payment_method: string | null
          payment_reference: string | null
          paystack_reference: string | null
          platform_fee: number | null
          price_per_unit: number
          proof_url: string | null
          property_id: string | null
          quarantine_reason: string | null
          quarantined_at: string | null
          status: string
          submitted_at: string | null
          total_paid: number
          units: number
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          id?: string
          member_id: string
          payment_method?: string | null
          payment_reference?: string | null
          paystack_reference?: string | null
          platform_fee?: number | null
          price_per_unit: number
          proof_url?: string | null
          property_id?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          status?: string
          submitted_at?: string | null
          total_paid: number
          units: number
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          id?: string
          member_id?: string
          payment_method?: string | null
          payment_reference?: string | null
          paystack_reference?: string | null
          platform_fee?: number | null
          price_per_unit?: number
          proof_url?: string | null
          property_id?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          status?: string
          submitted_at?: string | null
          total_paid?: number
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "reit_units_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reit_units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          automated_message_id: string | null
          channel: string | null
          created_at: string
          delivery_stats: Json
          error: string | null
          id: string
          recipient_count: number | null
          scheduled_for: string
          sent_at: string | null
          status: string
        }
        Insert: {
          automated_message_id?: string | null
          channel?: string | null
          created_at?: string
          delivery_stats?: Json
          error?: string | null
          id?: string
          recipient_count?: number | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          automated_message_id?: string | null
          channel?: string | null
          created_at?: string
          delivery_stats?: Json
          error?: string | null
          id?: string
          recipient_count?: number | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_automated_message_id_fkey"
            columns: ["automated_message_id"]
            isOneToOne: false
            referencedRelation: "automated_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          active: boolean | null
          carrier: string
          estimated_days: number | null
          id: string
          last_updated: string | null
          rate_per_kg_zar: number
          weight_from_kg: number
          weight_to_kg: number
        }
        Insert: {
          active?: boolean | null
          carrier: string
          estimated_days?: number | null
          id?: string
          last_updated?: string | null
          rate_per_kg_zar: number
          weight_from_kg: number
          weight_to_kg: number
        }
        Update: {
          active?: boolean | null
          carrier?: string
          estimated_days?: number | null
          id?: string
          last_updated?: string | null
          rate_per_kg_zar?: number
          weight_from_kg?: number
          weight_to_kg?: number
        }
        Relationships: []
      }
      spark_exchange: {
        Row: {
          buyer_id: string | null
          commission: number
          completed_at: string | null
          created_at: string | null
          id: string
          price_per_spark: number
          seller_id: string
          seller_receives: number
          spark_amount: number
          status: string | null
          total_price: number
        }
        Insert: {
          buyer_id?: string | null
          commission: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          price_per_spark?: number
          seller_id: string
          seller_receives: number
          spark_amount: number
          status?: string | null
          total_price: number
        }
        Update: {
          buyer_id?: string | null
          commission?: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          price_per_spark?: number
          seller_id?: string
          seller_receives?: number
          spark_amount?: number
          status?: string | null
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "spark_exchange_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_exchange_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_flip_games: {
        Row: {
          bet_sparks: number
          choice: string | null
          created_at: string | null
          id: string
          member_id: string
          payout: number | null
          result: string | null
        }
        Insert: {
          bet_sparks: number
          choice?: string | null
          created_at?: string | null
          id?: string
          member_id: string
          payout?: number | null
          result?: string | null
        }
        Update: {
          bet_sparks?: number
          choice?: string | null
          created_at?: string | null
          id?: string
          member_id?: string
          payout?: number | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spark_flip_games_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_purchases: {
        Row: {
          amount_paid: number
          bonus_sparks: number
          created_at: string
          email: string
          id: string
          member_id: string | null
          payment_reference: string | null
          phone: string | null
          sparks_added: number
          status: string
          tier: string
        }
        Insert: {
          amount_paid: number
          bonus_sparks?: number
          created_at?: string
          email: string
          id?: string
          member_id?: string | null
          payment_reference?: string | null
          phone?: string | null
          sparks_added: number
          status?: string
          tier: string
        }
        Update: {
          amount_paid?: number
          bonus_sparks?: number
          created_at?: string
          email?: string
          id?: string
          member_id?: string | null
          payment_reference?: string | null
          phone?: string | null
          sparks_added?: number
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "spark_purchases_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_trade_blueprints: {
        Row: {
          blueprint_json: Json | null
          confidence_score: number | null
          created_at: string | null
          estimated_gross_margin: number | null
          estimated_launch_timeline_days: number | null
          estimated_monthly_revenue: number | null
          estimated_startup_capital: number | null
          id: number
          income_goal: number | null
          member_id: string
          overall_moq_fill_percentage: number | null
          recommended_business_name: string | null
          recommended_products: Json | null
          updated_at: string | null
        }
        Insert: {
          blueprint_json?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          estimated_gross_margin?: number | null
          estimated_launch_timeline_days?: number | null
          estimated_monthly_revenue?: number | null
          estimated_startup_capital?: number | null
          id?: number
          income_goal?: number | null
          member_id: string
          overall_moq_fill_percentage?: number | null
          recommended_business_name?: string | null
          recommended_products?: Json | null
          updated_at?: string | null
        }
        Update: {
          blueprint_json?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          estimated_gross_margin?: number | null
          estimated_launch_timeline_days?: number | null
          estimated_monthly_revenue?: number | null
          estimated_startup_capital?: number | null
          id?: number
          income_goal?: number | null
          member_id?: string
          overall_moq_fill_percentage?: number | null
          recommended_business_name?: string | null
          recommended_products?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spark_trade_blueprints_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_trade_group_brand_investors: {
        Row: {
          created_at: string
          group_brand_id: string
          id: string
          investment_amount: number
          investor_user_id: string
          joined_at: string
          ownership_stake: number
          payment_reference: string | null
          payment_status: string
          quarantine_reason: string | null
          quarantined_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_brand_id: string
          id?: string
          investment_amount: number
          investor_user_id: string
          joined_at?: string
          ownership_stake?: number
          payment_reference?: string | null
          payment_status?: string
          quarantine_reason?: string | null
          quarantined_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_brand_id?: string
          id?: string
          investment_amount?: number
          investor_user_id?: string
          joined_at?: string
          ownership_stake?: number
          payment_reference?: string | null
          payment_status?: string
          quarantine_reason?: string | null
          quarantined_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spark_trade_group_brand_investors_group_brand_id_fkey"
            columns: ["group_brand_id"]
            isOneToOne: false
            referencedRelation: "spark_trade_group_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_trade_group_brands: {
        Row: {
          category: string
          created_at: string
          current_total_capital: number
          description: string | null
          founder_user_id: string
          id: string
          minimum_investment: number
          name: string
          oem_supplier_id: string | null
          oem_supplier_name: string | null
          product_image_url: string | null
          product_name: string
          retail_price_zar: number | null
          status: string
          target_investor_count: number | null
          target_total_capital: number
          unit_cost_usd: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          current_total_capital?: number
          description?: string | null
          founder_user_id: string
          id?: string
          minimum_investment?: number
          name: string
          oem_supplier_id?: string | null
          oem_supplier_name?: string | null
          product_image_url?: string | null
          product_name: string
          retail_price_zar?: number | null
          status?: string
          target_investor_count?: number | null
          target_total_capital?: number
          unit_cost_usd?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          current_total_capital?: number
          description?: string | null
          founder_user_id?: string
          id?: string
          minimum_investment?: number
          name?: string
          oem_supplier_id?: string | null
          oem_supplier_name?: string | null
          product_image_url?: string | null
          product_name?: string
          retail_price_zar?: number | null
          status?: string
          target_investor_count?: number | null
          target_total_capital?: number
          unit_cost_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      spark_trade_inventory_reservations: {
        Row: {
          created_at: string | null
          id: number
          member_id: string
          opportunity_id: number
          paid_at: string | null
          payment_reference: string | null
          quarantine_reason: string | null
          quarantined_at: string | null
          received_at: string | null
          reservation_status: string | null
          reserved_at: string | null
          shipped_at: string | null
          total_capital_allocated: number | null
          units_reserved: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          member_id: string
          opportunity_id: number
          paid_at?: string | null
          payment_reference?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          received_at?: string | null
          reservation_status?: string | null
          reserved_at?: string | null
          shipped_at?: string | null
          total_capital_allocated?: number | null
          units_reserved?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          member_id?: string
          opportunity_id?: number
          paid_at?: string | null
          payment_reference?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          received_at?: string | null
          reservation_status?: string | null
          reserved_at?: string | null
          shipped_at?: string | null
          total_capital_allocated?: number | null
          units_reserved?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spark_trade_inventory_reservations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_trade_inventory_reservations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "community_demand_meter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_trade_inventory_reservations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "spark_trade_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_trade_inventory_reservations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_product_commitment_status"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      spark_trade_joins: {
        Row: {
          created_at: string
          id: string
          member_id: string
          shortlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          shortlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          shortlist_id?: string
        }
        Relationships: []
      }
      spark_trade_marketplace_listings: {
        Row: {
          created_at: string | null
          id: number
          listing_status: string | null
          listing_url: string | null
          marketplace_country: string | null
          marketplace_name: string | null
          store_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          listing_status?: string | null
          listing_url?: string | null
          marketplace_country?: string | null
          marketplace_name?: string | null
          store_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          listing_status?: string | null
          listing_url?: string | null
          marketplace_country?: string | null
          marketplace_name?: string | null
          store_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spark_trade_marketplace_listings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "spark_trade_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_trade_opportunities: {
        Row: {
          category: string | null
          created_at: string | null
          current_reserved: number | null
          expected_arrival_date: string | null
          expected_margin_percentage: number | null
          expected_order_date: string | null
          group_buy_status: string | null
          id: number
          is_approved_for_ai_recommendation: boolean | null
          is_spotlight: boolean
          moq_required: number | null
          product_image_url: string | null
          product_name: string | null
          spotlight_rank: number | null
          spotlight_title: string | null
          stock_available: number | null
          stock_quantity: number
          suggested_selling_price_zar: number | null
          supplier_country: string | null
          supplier_name: string | null
          trending_direction: string | null
          unit_cost_zar: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          current_reserved?: number | null
          expected_arrival_date?: string | null
          expected_margin_percentage?: number | null
          expected_order_date?: string | null
          group_buy_status?: string | null
          id?: number
          is_approved_for_ai_recommendation?: boolean | null
          is_spotlight?: boolean
          moq_required?: number | null
          product_image_url?: string | null
          product_name?: string | null
          spotlight_rank?: number | null
          spotlight_title?: string | null
          stock_available?: number | null
          stock_quantity?: number
          suggested_selling_price_zar?: number | null
          supplier_country?: string | null
          supplier_name?: string | null
          trending_direction?: string | null
          unit_cost_zar?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          current_reserved?: number | null
          expected_arrival_date?: string | null
          expected_margin_percentage?: number | null
          expected_order_date?: string | null
          group_buy_status?: string | null
          id?: number
          is_approved_for_ai_recommendation?: boolean | null
          is_spotlight?: boolean
          moq_required?: number | null
          product_image_url?: string | null
          product_name?: string | null
          spotlight_rank?: number | null
          spotlight_title?: string | null
          stock_available?: number | null
          stock_quantity?: number
          suggested_selling_price_zar?: number | null
          supplier_country?: string | null
          supplier_name?: string | null
          trending_direction?: string | null
          unit_cost_zar?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      spark_trade_shortlist: {
        Row: {
          added_at: string | null
          amazon_fee: number | null
          asin: string
          category: string | null
          cost_breakdown: Json | null
          cost_price: number | null
          cost_updated_at: string | null
          data_source: string | null
          estimated_margin: number | null
          estimated_monthly_sales: number | null
          id: string
          is_demo: boolean
          joined_count: number | null
          margin_pct: number | null
          moq: number | null
          product_name: string | null
          sale_price: number | null
          sales_velocity: number | null
          shipping_est: number | null
          status: string | null
          target_slots: number | null
        }
        Insert: {
          added_at?: string | null
          amazon_fee?: number | null
          asin: string
          category?: string | null
          cost_breakdown?: Json | null
          cost_price?: number | null
          cost_updated_at?: string | null
          data_source?: string | null
          estimated_margin?: number | null
          estimated_monthly_sales?: number | null
          id?: string
          is_demo?: boolean
          joined_count?: number | null
          margin_pct?: number | null
          moq?: number | null
          product_name?: string | null
          sale_price?: number | null
          sales_velocity?: number | null
          shipping_est?: number | null
          status?: string | null
          target_slots?: number | null
        }
        Update: {
          added_at?: string | null
          amazon_fee?: number | null
          asin?: string
          category?: string | null
          cost_breakdown?: Json | null
          cost_price?: number | null
          cost_updated_at?: string | null
          data_source?: string | null
          estimated_margin?: number | null
          estimated_monthly_sales?: number | null
          id?: string
          is_demo?: boolean
          joined_count?: number | null
          margin_pct?: number | null
          moq?: number | null
          product_name?: string | null
          sale_price?: number | null
          sales_velocity?: number | null
          shipping_est?: number | null
          status?: string | null
          target_slots?: number | null
        }
        Relationships: []
      }
      spark_trade_stores: {
        Row: {
          accent_color: string | null
          banner_color: string | null
          blueprint_id: number
          created_at: string | null
          featured_products: Json | null
          id: number
          leads_generated_count: number | null
          member_id: string
          store_category: string | null
          store_description: string | null
          store_name: string | null
          store_template: string | null
          store_visit_count: number | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          banner_color?: string | null
          blueprint_id: number
          created_at?: string | null
          featured_products?: Json | null
          id?: number
          leads_generated_count?: number | null
          member_id: string
          store_category?: string | null
          store_description?: string | null
          store_name?: string | null
          store_template?: string | null
          store_visit_count?: number | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          banner_color?: string | null
          blueprint_id?: number
          created_at?: string | null
          featured_products?: Json | null
          id?: number
          leads_generated_count?: number | null
          member_id?: string
          store_category?: string | null
          store_description?: string | null
          store_name?: string | null
          store_template?: string | null
          store_visit_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spark_trade_stores_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "spark_trade_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_trade_stores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_trade_subscriptions: {
        Row: {
          access_end_date: string
          access_start_date: string
          amount_paid: number
          billing_period: string
          created_at: string
          email: string
          id: string
          member_id: string | null
          name: string
          payment_date: string | null
          payment_reference: string | null
          status: string
          tier: string
          user_id: string | null
          whatsapp: string
        }
        Insert: {
          access_end_date: string
          access_start_date?: string
          amount_paid: number
          billing_period: string
          created_at?: string
          email: string
          id?: string
          member_id?: string | null
          name: string
          payment_date?: string | null
          payment_reference?: string | null
          status?: string
          tier: string
          user_id?: string | null
          whatsapp: string
        }
        Update: {
          access_end_date?: string
          access_start_date?: string
          amount_paid?: number
          billing_period?: string
          created_at?: string
          email?: string
          id?: string
          member_id?: string | null
          name?: string
          payment_date?: string | null
          payment_reference?: string | null
          status?: string
          tier?: string
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      spark_transactions: {
        Row: {
          amount: number
          circle_tier: string | null
          created_at: string | null
          description: string | null
          fiat_amount: number | null
          fiat_ref: string | null
          from_member: string | null
          id: string
          status: string | null
          to_member: string | null
          tx_type: string
        }
        Insert: {
          amount: number
          circle_tier?: string | null
          created_at?: string | null
          description?: string | null
          fiat_amount?: number | null
          fiat_ref?: string | null
          from_member?: string | null
          id?: string
          status?: string | null
          to_member?: string | null
          tx_type: string
        }
        Update: {
          amount?: number
          circle_tier?: string | null
          created_at?: string | null
          description?: string | null
          fiat_amount?: number | null
          fiat_ref?: string | null
          from_member?: string | null
          id?: string
          status?: string | null
          to_member?: string | null
          tx_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "spark_transactions_from_member_fkey"
            columns: ["from_member"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_transactions_to_member_fkey"
            columns: ["to_member"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_wallets: {
        Row: {
          balance: number | null
          earned_balance: number
          id: string
          member_id: string
          promo_expires_at: string | null
          promotional_balance: number
          purchased_balance: number
          referral_balance: number
          referral_sparks_withdrawn: number
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          earned_balance?: number
          id?: string
          member_id: string
          promo_expires_at?: string | null
          promotional_balance?: number
          purchased_balance?: number
          referral_balance?: number
          referral_sparks_withdrawn?: number
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          earned_balance?: number
          id?: string
          member_id?: string
          promo_expires_at?: string | null
          promotional_balance?: number
          purchased_balance?: number
          referral_balance?: number
          referral_sparks_withdrawn?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spark_wallets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      st_buying_groups: {
        Row: {
          closes_at: string | null
          committed_units: number | null
          coordination_fee_pct: number | null
          created_at: string | null
          id: string
          min_order_units: number
          product_id: string
          ships_at: string | null
          status: string | null
          target_units: number
          unit_price: number
        }
        Insert: {
          closes_at?: string | null
          committed_units?: number | null
          coordination_fee_pct?: number | null
          created_at?: string | null
          id?: string
          min_order_units: number
          product_id: string
          ships_at?: string | null
          status?: string | null
          target_units: number
          unit_price: number
        }
        Update: {
          closes_at?: string | null
          committed_units?: number | null
          coordination_fee_pct?: number | null
          created_at?: string | null
          id?: string
          min_order_units?: number
          product_id?: string
          ships_at?: string | null
          status?: string | null
          target_units?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "st_buying_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "st_products"
            referencedColumns: ["id"]
          },
        ]
      }
      st_orders: {
        Row: {
          coord_fee: number
          created_at: string | null
          financed_amount: number | null
          group_id: string
          id: string
          member_id: string
          order_total: number
          payment_ref: string | null
          status: string | null
          unit_price: number
          units: number
        }
        Insert: {
          coord_fee: number
          created_at?: string | null
          financed_amount?: number | null
          group_id: string
          id?: string
          member_id: string
          order_total: number
          payment_ref?: string | null
          status?: string | null
          unit_price: number
          units: number
        }
        Update: {
          coord_fee?: number
          created_at?: string | null
          financed_amount?: number | null
          group_id?: string
          id?: string
          member_id?: string
          order_total?: number
          payment_ref?: string | null
          status?: string | null
          unit_price?: number
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "st_orders_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "st_buying_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "st_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      st_products: {
        Row: {
          category: string
          created_at: string | null
          customs_duty: number
          freight_cost: number
          gross_margin: number
          id: string
          is_active: boolean | null
          landed_cost: number
          margin_pct: number
          market_price_zar: number
          marketplace: string
          moq: number | null
          platform_fee_pct: number
          product_name: string
          return_rate_avg: number
          seller_count: number | null
          supplier_url: string | null
          true_net_margin: number
          units_sold_30d: number | null
          week_of: string
          wholesale_price: number
        }
        Insert: {
          category: string
          created_at?: string | null
          customs_duty: number
          freight_cost: number
          gross_margin: number
          id?: string
          is_active?: boolean | null
          landed_cost: number
          margin_pct: number
          market_price_zar: number
          marketplace: string
          moq?: number | null
          platform_fee_pct: number
          product_name: string
          return_rate_avg: number
          seller_count?: number | null
          supplier_url?: string | null
          true_net_margin: number
          units_sold_30d?: number | null
          week_of: string
          wholesale_price: number
        }
        Update: {
          category?: string
          created_at?: string | null
          customs_duty?: number
          freight_cost?: number
          gross_margin?: number
          id?: string
          is_active?: boolean | null
          landed_cost?: number
          margin_pct?: number
          market_price_zar?: number
          marketplace?: string
          moq?: number | null
          platform_fee_pct?: number
          product_name?: string
          return_rate_avg?: number
          seller_count?: number | null
          supplier_url?: string | null
          true_net_margin?: number
          units_sold_30d?: number | null
          week_of?: string
          wholesale_price?: number
        }
        Relationships: []
      }
      storefront_accounts: {
        Row: {
          brand_color: string | null
          created_at: string
          id: string
          name: string
          slug: string
          tagline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          tagline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tagline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storefront_reviews: {
        Row: {
          created_at: string
          id: string
          rating: number
          review_text: string
          reviewer_id: string
          storefront_owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          review_text: string
          reviewer_id: string
          storefront_owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          review_text?: string
          reviewer_id?: string
          storefront_owner_id?: string
        }
        Relationships: []
      }
      storefronts: {
        Row: {
          accent_color: string
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          is_active: boolean
          member_id: string
          updated_at: string
          view_count: number
        }
        Insert: {
          accent_color?: string
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          member_id: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          accent_color?: string
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          member_id?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          display_name: string
          features: Json | null
          id: string
          is_active: boolean | null
          monthly_price: number
          paystack_plan_code: string
          tier_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_price: number
          paystack_plan_code: string
          tier_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_price?: number
          paystack_plan_code?: string
          tier_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      takealot_products: {
        Row: {
          category: string | null
          id: string
          image_url: string | null
          rating: number | null
          scraped_at: string
          seller_count: number | null
          takealot_name: string
          takealot_price: number | null
          takealot_url: string | null
        }
        Insert: {
          category?: string | null
          id?: string
          image_url?: string | null
          rating?: number | null
          scraped_at?: string
          seller_count?: number | null
          takealot_name: string
          takealot_price?: number | null
          takealot_url?: string | null
        }
        Update: {
          category?: string | null
          id?: string
          image_url?: string | null
          rating?: number | null
          scraped_at?: string
          seller_count?: number | null
          takealot_name?: string
          takealot_price?: number | null
          takealot_url?: string | null
        }
        Relationships: []
      }
      takealot_scrape_jobs: {
        Row: {
          category: string
          collection_id: string
          created_at: string
          error_message: string | null
          id: number
          polling_completed_at: string | null
          polling_started_at: string | null
          product_count: number | null
          status: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          category: string
          collection_id: string
          created_at?: string
          error_message?: string | null
          id?: never
          polling_completed_at?: string | null
          polling_started_at?: string | null
          product_count?: number | null
          status?: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          category?: string
          collection_id?: string
          created_at?: string
          error_message?: string | null
          id?: never
          polling_completed_at?: string | null
          polling_started_at?: string | null
          product_count?: number | null
          status?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      trending_products: {
        Row: {
          admin_notes: string | null
          category: string | null
          created_at: string | null
          description: string | null
          estimated_fob_price: number | null
          estimated_sa_market_price: number | null
          featured: boolean | null
          id: string
          image_url: string | null
          margin_percentage: number | null
          product_name: string
          sa_available: boolean | null
          source: string | null
          source_url: string | null
          supplier_links: Json | null
          tags: string[] | null
          trending_score: number | null
          trending_since: string | null
          updated_at: string | null
          views_count: number | null
          viral_content_links: Json | null
        }
        Insert: {
          admin_notes?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          estimated_fob_price?: number | null
          estimated_sa_market_price?: number | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          margin_percentage?: number | null
          product_name: string
          sa_available?: boolean | null
          source?: string | null
          source_url?: string | null
          supplier_links?: Json | null
          tags?: string[] | null
          trending_score?: number | null
          trending_since?: string | null
          updated_at?: string | null
          views_count?: number | null
          viral_content_links?: Json | null
        }
        Update: {
          admin_notes?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          estimated_fob_price?: number | null
          estimated_sa_market_price?: number | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          margin_percentage?: number | null
          product_name?: string
          sa_available?: boolean | null
          source?: string | null
          source_url?: string | null
          supplier_links?: Json | null
          tags?: string[] | null
          trending_score?: number | null
          trending_since?: string | null
          updated_at?: string | null
          views_count?: number | null
          viral_content_links?: Json | null
        }
        Relationships: []
      }
      ubuntu_fund: {
        Row: {
          balance: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ubuntu_fund_txns: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          direction: string
          id: string
          note: string | null
          source_bid: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          direction: string
          id?: string
          note?: string | null
          source_bid?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          direction?: string
          id?: string
          note?: string | null
          source_bid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ubuntu_fund_txns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubuntu_fund_txns_source_bid_fkey"
            columns: ["source_bid"]
            isOneToOne: false
            referencedRelation: "circle_bids"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          city: string | null
          converted: boolean | null
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          city?: string | null
          converted?: boolean | null
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          city?: string | null
          converted?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          account_holder: string
          account_number: string
          amount_r_gross: number
          amount_r_net: number
          amount_sparks: number
          bank_name: string
          branch_code: string | null
          completed_at: string | null
          created_at: string
          failure_reason: string | null
          fee_charged: number
          fee_rate: number
          id: string
          includes_promotional: boolean
          member_id: string
          promotional_amount: number
          reference_number: string
          spark_rate: number
          status: string
          unlock_via_circle: string | null
        }
        Insert: {
          account_holder: string
          account_number: string
          amount_r_gross: number
          amount_r_net: number
          amount_sparks: number
          bank_name: string
          branch_code?: string | null
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          fee_charged: number
          fee_rate?: number
          id?: string
          includes_promotional?: boolean
          member_id: string
          promotional_amount?: number
          reference_number: string
          spark_rate?: number
          status?: string
          unlock_via_circle?: string | null
        }
        Update: {
          account_holder?: string
          account_number?: string
          amount_r_gross?: number
          amount_r_net?: number
          amount_sparks?: number
          bank_name?: string
          branch_code?: string | null
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          fee_charged?: number
          fee_rate?: number
          id?: string
          includes_promotional?: boolean
          member_id?: string
          promotional_amount?: number
          reference_number?: string
          spark_rate?: number
          status?: string
          unlock_via_circle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_unlock_via_circle_fkey"
            columns: ["unlock_via_circle"]
            isOneToOne: false
            referencedRelation: "circle_bids"
            referencedColumns: ["id"]
          },
        ]
      }
      zcreator_analytics: {
        Row: {
          comments: number
          content_id: string
          estimated_revenue_rands: number
          id: string
          likes: number
          platform: string
          shares: number
          synced_at: string
          views: number
          watch_time_minutes: number
        }
        Insert: {
          comments?: number
          content_id: string
          estimated_revenue_rands?: number
          id?: string
          likes?: number
          platform: string
          shares?: number
          synced_at?: string
          views?: number
          watch_time_minutes?: number
        }
        Update: {
          comments?: number
          content_id?: string
          estimated_revenue_rands?: number
          id?: string
          likes?: number
          platform?: string
          shares?: number
          synced_at?: string
          views?: number
          watch_time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "zcreator_analytics_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "zcreator_content_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      zcreator_content_queue: {
        Row: {
          actual_published_at: string | null
          agent_id: string | null
          cancel_requested: boolean
          captions_url: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          generation_cost_rands: number | null
          generation_progress: Json | null
          id: string
          platform_metadata: Json | null
          platforms: string[] | null
          scheduled_publish_at: string | null
          script_content: string | null
          script_title: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          video_style: string | null
          video_url: string | null
        }
        Insert: {
          actual_published_at?: string | null
          agent_id?: string | null
          cancel_requested?: boolean
          captions_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          generation_cost_rands?: number | null
          generation_progress?: Json | null
          id?: string
          platform_metadata?: Json | null
          platforms?: string[] | null
          scheduled_publish_at?: string | null
          script_content?: string | null
          script_title?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          video_style?: string | null
          video_url?: string | null
        }
        Update: {
          actual_published_at?: string | null
          agent_id?: string | null
          cancel_requested?: boolean
          captions_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          generation_cost_rands?: number | null
          generation_progress?: Json | null
          id?: string
          platform_metadata?: Json | null
          platforms?: string[] | null
          scheduled_publish_at?: string | null
          script_content?: string | null
          script_title?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          video_style?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zcreator_content_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "zcreator_story_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      zcreator_job_queue: {
        Row: {
          completed_at: string | null
          content_id: string
          error_message: string | null
          id: string
          priority: number
          queued_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["zcreator_job_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          error_message?: string | null
          id?: string
          priority?: number
          queued_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["zcreator_job_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          error_message?: string | null
          id?: string
          priority?: number
          queued_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["zcreator_job_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zcreator_job_queue_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "zcreator_content_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      zcreator_published_content: {
        Row: {
          content_id: string
          id: string
          platform: string
          platform_url: string | null
          platform_video_id: string | null
          published_at: string
        }
        Insert: {
          content_id: string
          id?: string
          platform: string
          platform_url?: string | null
          platform_video_id?: string | null
          published_at?: string
        }
        Update: {
          content_id?: string
          id?: string
          platform?: string
          platform_url?: string | null
          platform_video_id?: string | null
          published_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zcreator_published_content_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "zcreator_content_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      zcreator_story_agents: {
        Row: {
          active: boolean
          agent_name: string
          auto_generate: boolean
          auto_publish: boolean
          brand_voice: Json | null
          content_frequency: string | null
          created_at: string
          id: string
          niche: string | null
          performance_score: number
          platforms: string[] | null
          updated_at: string
          user_id: string
          videos_created: number
        }
        Insert: {
          active?: boolean
          agent_name: string
          auto_generate?: boolean
          auto_publish?: boolean
          brand_voice?: Json | null
          content_frequency?: string | null
          created_at?: string
          id?: string
          niche?: string | null
          performance_score?: number
          platforms?: string[] | null
          updated_at?: string
          user_id: string
          videos_created?: number
        }
        Update: {
          active?: boolean
          agent_name?: string
          auto_generate?: boolean
          auto_publish?: boolean
          brand_voice?: Json | null
          content_frequency?: string | null
          created_at?: string
          id?: string
          niche?: string | null
          performance_score?: number
          platforms?: string[] | null
          updated_at?: string
          user_id?: string
          videos_created?: number
        }
        Relationships: []
      }
      zcreator_subscriptions: {
        Row: {
          active: boolean
          auto_publish_enabled: boolean
          billing_cycle_starts_at: string | null
          created_at: string
          id: string
          monthly_cost_rands: number | null
          monthly_cost_sparks: number | null
          platforms_enabled: string[] | null
          tier: string
          user_id: string
          videos_per_month: number | null
          videos_used_this_month: number
          white_label_enabled: boolean
        }
        Insert: {
          active?: boolean
          auto_publish_enabled?: boolean
          billing_cycle_starts_at?: string | null
          created_at?: string
          id?: string
          monthly_cost_rands?: number | null
          monthly_cost_sparks?: number | null
          platforms_enabled?: string[] | null
          tier?: string
          user_id: string
          videos_per_month?: number | null
          videos_used_this_month?: number
          white_label_enabled?: boolean
        }
        Update: {
          active?: boolean
          auto_publish_enabled?: boolean
          billing_cycle_starts_at?: string | null
          created_at?: string
          id?: string
          monthly_cost_rands?: number | null
          monthly_cost_sparks?: number | null
          platforms_enabled?: string[] | null
          tier?: string
          user_id?: string
          videos_per_month?: number | null
          videos_used_this_month?: number
          white_label_enabled?: boolean
        }
        Relationships: []
      }
      zcreator_video_styles: {
        Row: {
          available: boolean
          cost_rands: number
          description: string | null
          display_name: string
          generation_time_minutes: number | null
          id: string
          quality_tier: string | null
          sample_video_url: string | null
          style_code: string
        }
        Insert: {
          available?: boolean
          cost_rands?: number
          description?: string | null
          display_name: string
          generation_time_minutes?: number | null
          id?: string
          quality_tier?: string | null
          sample_video_url?: string | null
          style_code: string
        }
        Update: {
          available?: boolean
          cost_rands?: number
          description?: string | null
          display_name?: string
          generation_time_minutes?: number | null
          id?: string
          quality_tier?: string | null
          sample_video_url?: string | null
          style_code?: string
        }
        Relationships: []
      }
      zcreator_youtube_tokens: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          channel_id: string | null
          channel_title: string | null
          created_at: string
          default_privacy: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          channel_id?: string | null
          channel_title?: string | null
          created_at?: string
          default_privacy?: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          channel_id?: string | null
          channel_title?: string | null
          created_at?: string
          default_privacy?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      community_demand_meter: {
        Row: {
          expected_order_date: string | null
          fill_percentage: number | null
          id: number | null
          members_interested: number | null
          moq_required: number | null
          product_image_url: string | null
          product_name: string | null
          total_reserved: number | null
          units_remaining: number | null
        }
        Relationships: []
      }
      drive_tier_pool_v: {
        Row: {
          active_members: number | null
          pool_total: number | null
          tier_id: string | null
          tier_name: string | null
        }
        Relationships: []
      }
      spark_exchange_mine: {
        Row: {
          buyer_id: string | null
          commission: number | null
          completed_at: string | null
          created_at: string | null
          id: string | null
          price_per_spark: number | null
          seller_id: string | null
          seller_receives: number | null
          spark_amount: number | null
          status: string | null
          total_price: number | null
        }
        Insert: {
          buyer_id?: string | null
          commission?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string | null
          price_per_spark?: number | null
          seller_id?: string | null
          seller_receives?: number | null
          spark_amount?: number | null
          status?: string | null
          total_price?: number | null
        }
        Update: {
          buyer_id?: string | null
          commission?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string | null
          price_per_spark?: number | null
          seller_id?: string | null
          seller_receives?: number | null
          spark_amount?: number | null
          status?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spark_exchange_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_exchange_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      v_product_commitment_status: {
        Row: {
          last_activity_at: string | null
          legacy_reserved: number | null
          members_committed: number | null
          moq_required: number | null
          opportunity_id: number | null
          product_name: string | null
          progress_percent: number | null
          status: string | null
          total_capital: number | null
          total_units: number | null
        }
        Relationships: []
      }
      v_products_pending_supplier: {
        Row: {
          category: string | null
          date_sent_to_supplier: string | null
          estimated_margin_pct: number | null
          id: number | null
          product_name: string | null
          status: string | null
        }
        Insert: {
          category?: string | null
          date_sent_to_supplier?: string | null
          estimated_margin_pct?: number | null
          id?: number | null
          product_name?: string | null
          status?: string | null
        }
        Update: {
          category?: string | null
          date_sent_to_supplier?: string | null
          estimated_margin_pct?: number | null
          id?: number | null
          product_name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      v_products_ready_to_publish: {
        Row: {
          category: string | null
          estimated_margin_pct: number | null
          final_moq: number | null
          final_supplier_price_zar: number | null
          id: number | null
          lead_time_days: number | null
          product_name: string | null
        }
        Insert: {
          category?: string | null
          estimated_margin_pct?: number | null
          final_moq?: number | null
          final_supplier_price_zar?: number | null
          id?: number | null
          lead_time_days?: number | null
          product_name?: string | null
        }
        Update: {
          category?: string | null
          estimated_margin_pct?: number | null
          final_moq?: number | null
          final_supplier_price_zar?: number | null
          id?: number | null
          lead_time_days?: number | null
          product_name?: string | null
        }
        Relationships: []
      }
      v_spark_trade_products: {
        Row: {
          category: string | null
          image_url: string | null
          last_updated: string | null
          name: string | null
          opportunity_score: number | null
          price_zar: number | null
          product_key: string | null
          rating: number | null
          review_count: number | null
          sales_rank: number | null
          source: string | null
          source_id: string | null
          source_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _flip_contributed: { Args: { _member: string }; Returns: undefined }
      _gen_withdrawal_ref: { Args: never; Returns: string }
      _promo_unlock_bonus: { Args: { _fiat: number }; Returns: number }
      active_members_count: { Args: never; Returns: number }
      adjust_spark_balance: {
        Args: { _delta: number; _member: string; _note?: string }
        Returns: number
      }
      admin_adjust_sparks: {
        Args: { _delta: number; _member: string; _reason: string }
        Returns: number
      }
      admin_approve_buyers_club: {
        Args: { _member: string }
        Returns: undefined
      }
      admin_approve_fulfillment: {
        Args: { _application_id: string }
        Returns: string
      }
      admin_approve_kyc: {
        Args: { _member: string; _override_reason?: string }
        Returns: undefined
      }
      admin_award_referral_bonus: {
        Args: { _amount: number; _member: string; _note?: string }
        Returns: number
      }
      admin_delete_user: { Args: { _user_id: string }; Returns: Json }
      admin_extend_buyers_club: {
        Args: { _member: string; _months?: number }
        Returns: string
      }
      admin_fraud_dashboard: { Args: never; Returns: Json }
      admin_freeze_member: {
        Args: { _member: string; _reason: string }
        Returns: undefined
      }
      admin_list_predictor_questions: {
        Args: never
        Returns: {
          category: string | null
          closes_at: string | null
          correct_answer: string | null
          created_at: string | null
          id: string
          options: Json | null
          question: string
          sparks_cost: number | null
          sparks_reward: number | null
          status: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "predictor_questions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_member_transactions: {
        Args: { _limit?: number; _member: string }
        Returns: {
          amount: number
          created_at: string
          description: string
          from_member: string
          id: string
          status: string
          to_member: string
          tx_type: string
        }[]
      }
      admin_recalc_all_fraud_scores: { Args: never; Returns: number }
      admin_record_kyc_reminder: { Args: { _member: string }; Returns: Json }
      admin_referral_overview: { Args: never; Returns: Json }
      admin_reject_buyers_club: {
        Args: { _member: string; _reason: string }
        Returns: undefined
      }
      admin_reject_fulfillment: {
        Args: { _application_id: string; _reason: string }
        Returns: undefined
      }
      admin_revenue_dashboard: { Args: { _days?: number }; Returns: Json }
      admin_revert_kyc: {
        Args: { _member: string; _reason?: string }
        Returns: undefined
      }
      admin_review_ugc_submission: {
        Args: {
          _decision: string
          _notes?: string
          _reward?: number
          _submission_id: string
        }
        Returns: Json
      }
      admin_top_referrers_month: {
        Args: { _limit?: number }
        Returns: {
          full_name: string
          member_id: string
          refs_this_month: number
        }[]
      }
      admin_unfreeze_member: { Args: { _member: string }; Returns: undefined }
      allocate_circle_payouts: {
        Args: never
        Returns: {
          allocated_count: number
          error_message: string
        }[]
      }
      apply_allocation: {
        Args: {
          _breakdown: Json
          _pool_total: number
          _tier: string
          _winner_bid_ids: string[]
        }
        Returns: string
      }
      apply_referral_signup: { Args: { _code: string }; Returns: Json }
      apply_spark_flip_outcome: {
        Args: { _bet: number; _choice: string; _spark_type: string }
        Returns: Json
      }
      apply_spark_purchase: {
        Args: {
          _amount_paid: number
          _bonus: number
          _email: string
          _member: string
          _phone: string
          _reference: string
          _sparks: number
          _tier: string
        }
        Returns: Json
      }
      assign_referrer: {
        Args: { _member: string; _referrer: string }
        Returns: Json
      }
      award_kyc_referral_bonus: { Args: { _member?: string }; Returns: boolean }
      boost_circle_bid: { Args: { _bid_id: string }; Returns: Json }
      bump_member_video_metric: {
        Args: { _id: string; _metric: string }
        Returns: undefined
      }
      calculate_drive_score: {
        Args: { p_enrollment_id: string }
        Returns: number
      }
      calculate_fraud_score: { Args: { _member: string }; Returns: Json }
      circle_tier_stats: {
        Args: never
        Returns: {
          members: number
          pool: number
          tier: string
        }[]
      }
      claim_free_sparks: { Args: { _claim_type: string }; Returns: Json }
      claim_signup_bonus: { Args: never; Returns: number }
      compute_session_scores: {
        Args: { _tier: string }
        Returns: {
          bid_boost_score: number
          bid_id: string
          breakdown: Json
          community_score: number
          consistency_pct: number
          consistency_score: number
          days_waiting: number
          eligible: boolean
          fiat_amount: number
          full_name: string
          member_id: string
          override_type: string
          override_value: number
          priority_score: number
          time_waiting_score: number
          volume_score: number
        }[]
      }
      expire_unpaid_bids: { Args: never; Returns: number }
      flame_graphics_count_week: { Args: never; Returns: number }
      flame_video_count_week: { Args: never; Returns: number }
      gen_referral_code: { Args: { _seed?: string }; Returns: string }
      get_active_bank_account: {
        Args: { _project: string }
        Returns: {
          account_holder: string
          account_name: string
          account_number: string
          bank_name: string
          branch_code: string
          id: string
        }[]
      }
      get_email_recipients: {
        Args: { _audience: string; _ids?: string[]; _tier?: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      get_member_platform_settings: {
        Args: never
        Returns: {
          account_name: string
          account_number: string
          bank_name: string
          branch_code: string
          growth_override_open: boolean
          harvest_override_open: boolean
          override_expires_at: string
          payment_instructions: string
          payouts_growth: number
          payouts_harvest: number
          payouts_seed: number
          seed_override_open: boolean
        }[]
      }
      get_my_circle_queue_status: {
        Args: never
        Returns: {
          bid_id: string
          created_at: string
          days_remaining: number
          effective_vault_end: string
          fiat_amount: number
          hours_remaining: number
          payment_confirmed_at: string
          payout_amount: number
          payout_date: string
          priority_score: number
          queue_position: number
          status: string
          tier: string
          total_active: number
          vault_end: string
          vault_start: string
        }[]
      }
      get_predictor_answer: { Args: { _question: string }; Returns: string }
      get_vault_queue: {
        Args: { _limit?: number; _tier: string }
        Returns: {
          created_at: string
          fiat_amount: number
          id: string
          member_id: string
          status: string
          tier: string
          vault_start: string
        }[]
      }
      get_vault_queue_count: { Args: { _tier: string }; Returns: number }
      get_vault_queue_position: {
        Args: { _created_at: string; _tier: string }
        Returns: number
      }
      increment_podcast_play: { Args: { _episode: string }; Returns: undefined }
      increment_storefront_view: {
        Args: { _owner: string }
        Returns: undefined
      }
      increment_ubuntu_fund: {
        Args: { contribution: number }
        Returns: undefined
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      join_spark_trade: { Args: { _id: string }; Returns: undefined }
      lookup_referrer: {
        Args: { _code: string }
        Returns: {
          full_name: string
        }[]
      }
      mark_contributed: { Args: { _member?: string }; Returns: undefined }
      mark_overdue_circle_payouts: { Args: never; Returns: number }
      member_video_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          full_name: string
          member_id: string
          total_shares: number
          total_signups: number
          videos_count: number
        }[]
      }
      my_referred_members: {
        Args: never
        Returns: {
          full_name: string
          id: string
          joined_at: string
          kyc_level: number
        }[]
      }
      predictor_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          correct: number
          full_name: string
          member_id: string
          sparks_won: number
        }[]
      }
      qualifying_contribution_zar: {
        Args: { _member: string }
        Returns: number
      }
      record_circle_payout: {
        Args: {
          _bid_id: string
          _method: string
          _net_amount: number
          _paid_on?: string
          _reference: string
        }
        Returns: undefined
      }
      redeem_invite_code: { Args: { _code: string }; Returns: boolean }
      referral_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          full_name: string
          member_id: string
          referral_code: string
          sparks_earned: number
          total_refs: number
        }[]
      }
      referral_stats: {
        Args: { _member?: string }
        Returns: {
          sparks_earned: number
          total_refs: number
        }[]
      }
      releasable_referral_sparks: { Args: { _member: string }; Returns: number }
      run_drive_allocation: { Args: { p_tier_id: string }; Returns: Json }
      spark_balance_breakdown: { Args: { _member?: string }; Returns: Json }
      submit_buyers_club_payment: {
        Args: { _amount: number; _proof_url: string; _tier: string }
        Returns: undefined
      }
      submit_drive_eft_contribution: {
        Args: {
          _amount: number
          _enrollment: string
          _proof_url: string
          _ref: string
        }
        Returns: string
      }
      submit_withdrawal_request: {
        Args: {
          _account_holder: string
          _account_number: string
          _amount_sparks: number
          _bank_name: string
          _branch_code?: string
          _include_promotional?: boolean
        }
        Returns: Json
      }
      touch_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      zcreator_job_status: "queued" | "processing" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      zcreator_job_status: ["queued", "processing", "completed", "failed"],
    },
  },
} as const
