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
          consistency_percentage: number | null
          created_at: string | null
          days_waiting: number | null
          fiat_amount: number
          id: string
          matched_to: string | null
          member_id: string
          net_amount: number
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_ref: string | null
          payment_reference: string | null
          payment_submitted_at: string | null
          payout_amount: number | null
          payout_date: string | null
          payout_rank: number | null
          paystack_reference: string | null
          platform_fee: number
          priority_score: number | null
          priority_slot: boolean | null
          score_breakdown: Json | null
          spark_amount: number
          status: string | null
          streak_bonus: number | null
          tier: string
          ubuntu_fund_cut: number
          updated_at: string | null
          vault_end: string | null
          vault_start: string | null
        }
        Insert: {
          allocated_at?: string | null
          consistency_percentage?: number | null
          created_at?: string | null
          days_waiting?: number | null
          fiat_amount: number
          id?: string
          matched_to?: string | null
          member_id: string
          net_amount: number
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_ref?: string | null
          payment_reference?: string | null
          payment_submitted_at?: string | null
          payout_amount?: number | null
          payout_date?: string | null
          payout_rank?: number | null
          paystack_reference?: string | null
          platform_fee: number
          priority_score?: number | null
          priority_slot?: boolean | null
          score_breakdown?: Json | null
          spark_amount: number
          status?: string | null
          streak_bonus?: number | null
          tier: string
          ubuntu_fund_cut: number
          updated_at?: string | null
          vault_end?: string | null
          vault_start?: string | null
        }
        Update: {
          allocated_at?: string | null
          consistency_percentage?: number | null
          created_at?: string | null
          days_waiting?: number | null
          fiat_amount?: number
          id?: string
          matched_to?: string | null
          member_id?: string
          net_amount?: number
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_ref?: string | null
          payment_reference?: string | null
          payment_submitted_at?: string | null
          payout_amount?: number | null
          payout_date?: string | null
          payout_rank?: number | null
          paystack_reference?: string | null
          platform_fee?: number
          priority_score?: number | null
          priority_slot?: boolean | null
          score_breakdown?: Json | null
          spark_amount?: number
          status?: string | null
          streak_bonus?: number | null
          tier?: string
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
      members: {
        Row: {
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
          community_score: number
          consistency_score: number
          contribution_volume_score: number
          created_at: string | null
          document_number: string | null
          document_type: string | null
          dream_goal: string | null
          email: string | null
          email_preferences: Json
          first_contribution_at: string | null
          full_name: string
          has_buyers_club_access: boolean
          has_contributed: boolean
          id: string
          id_number: string | null
          is_active: boolean | null
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
          last_seen_at: string | null
          paystack_customer_code: string | null
          paystack_plan_code: string | null
          paystack_reference: string | null
          paystack_subscription_code: string | null
          phone: string
          phone_verified: boolean
          priority_score: number
          rank: string | null
          referral_code: string | null
          referred_by: string | null
          referred_by_code: string | null
          spark_link_code: string | null
          status: string
          streak_count: number | null
          time_waiting_score: number
          total_cycles: number | null
          tour_banner_dismissed_at: string | null
        }
        Insert: {
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
          community_score?: number
          consistency_score?: number
          contribution_volume_score?: number
          created_at?: string | null
          document_number?: string | null
          document_type?: string | null
          dream_goal?: string | null
          email?: string | null
          email_preferences?: Json
          first_contribution_at?: string | null
          full_name: string
          has_buyers_club_access?: boolean
          has_contributed?: boolean
          id?: string
          id_number?: string | null
          is_active?: boolean | null
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
          last_seen_at?: string | null
          paystack_customer_code?: string | null
          paystack_plan_code?: string | null
          paystack_reference?: string | null
          paystack_subscription_code?: string | null
          phone: string
          phone_verified?: boolean
          priority_score?: number
          rank?: string | null
          referral_code?: string | null
          referred_by?: string | null
          referred_by_code?: string | null
          spark_link_code?: string | null
          status?: string
          streak_count?: number | null
          time_waiting_score?: number
          total_cycles?: number | null
          tour_banner_dismissed_at?: string | null
        }
        Update: {
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
          community_score?: number
          consistency_score?: number
          contribution_volume_score?: number
          created_at?: string | null
          document_number?: string | null
          document_type?: string | null
          dream_goal?: string | null
          email?: string | null
          email_preferences?: Json
          first_contribution_at?: string | null
          full_name?: string
          has_buyers_club_access?: boolean
          has_contributed?: boolean
          id?: string
          id_number?: string | null
          is_active?: boolean | null
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
          last_seen_at?: string | null
          paystack_customer_code?: string | null
          paystack_plan_code?: string | null
          paystack_reference?: string | null
          paystack_subscription_code?: string | null
          phone?: string
          phone_verified?: boolean
          priority_score?: number
          rank?: string | null
          referral_code?: string | null
          referred_by?: string | null
          referred_by_code?: string | null
          spark_link_code?: string | null
          status?: string
          streak_count?: number | null
          time_waiting_score?: number
          total_cycles?: number | null
          tour_banner_dismissed_at?: string | null
        }
        Relationships: [
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
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch_code?: string | null
          created_at?: string
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
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch_code?: string | null
          created_at?: string
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
          id: string
          member_id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          id?: string
          member_id: string
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          id?: string
          member_id?: string
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
    }
    Views: {
      drive_tier_pool_v: {
        Row: {
          active_members: number | null
          pool_total: number | null
          tier_id: string | null
          tier_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _flip_contributed: { Args: { _member: string }; Returns: undefined }
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
      admin_top_referrers_month: {
        Args: { _limit?: number }
        Returns: {
          full_name: string
          member_id: string
          refs_this_month: number
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
      assign_referrer: {
        Args: { _member: string; _referrer: string }
        Returns: Json
      }
      award_kyc_referral_bonus: { Args: { _member?: string }; Returns: boolean }
      calculate_drive_score: {
        Args: { p_enrollment_id: string }
        Returns: number
      }
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
      increment_storefront_view: {
        Args: { _owner: string }
        Returns: undefined
      }
      increment_ubuntu_fund: {
        Args: { contribution: number }
        Returns: undefined
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      join_spark_trade: { Args: { _id: string }; Returns: undefined }
      lookup_referrer: {
        Args: { _code: string }
        Returns: {
          full_name: string
        }[]
      }
      mark_contributed: { Args: { _member?: string }; Returns: undefined }
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
      run_drive_allocation: { Args: { p_tier_id: string }; Returns: Json }
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
      touch_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
