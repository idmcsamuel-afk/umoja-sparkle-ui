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
      circle_bids: {
        Row: {
          created_at: string | null
          fiat_amount: number
          id: string
          matched_to: string | null
          member_id: string
          net_amount: number
          payment_ref: string | null
          payout_amount: number | null
          platform_fee: number
          priority_slot: boolean | null
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
          created_at?: string | null
          fiat_amount: number
          id?: string
          matched_to?: string | null
          member_id: string
          net_amount: number
          payment_ref?: string | null
          payout_amount?: number | null
          platform_fee: number
          priority_slot?: boolean | null
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
          created_at?: string | null
          fiat_amount?: number
          id?: string
          matched_to?: string | null
          member_id?: string
          net_amount?: number
          payment_ref?: string | null
          payout_amount?: number | null
          platform_fee?: number
          priority_slot?: boolean | null
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
          status: string | null
          total_contributed: number | null
        }
        Insert: {
          circle_id?: string | null
          id?: string
          joined_at?: string | null
          member_id?: string | null
          status?: string | null
          total_contributed?: number | null
        }
        Update: {
          circle_id?: string | null
          id?: string
          joined_at?: string | null
          member_id?: string | null
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
          circle_size: number
          created_at: string | null
          description: string | null
          id: string
          name: string
          pool_target: number
          status: string | null
          weekly_contribution: number
        }
        Insert: {
          car_image_url?: string | null
          car_make?: string | null
          car_model?: string | null
          car_year?: number | null
          circle_size: number
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          pool_target: number
          status?: string | null
          weekly_contribution: number
        }
        Update: {
          car_image_url?: string | null
          car_make?: string | null
          car_model?: string | null
          car_year?: number | null
          circle_size?: number
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          pool_target?: number
          status?: string | null
          weekly_contribution?: number
        }
        Relationships: []
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
          created_at: string | null
          document_number: string | null
          document_type: string | null
          dream_goal: string | null
          email: string | null
          full_name: string
          id: string
          id_number: string | null
          is_active: boolean | null
          is_admin: boolean | null
          kyc_status: string | null
          phone: string
          rank: string | null
          referred_by: string | null
          spark_link_code: string | null
          streak_count: number | null
          total_cycles: number | null
        }
        Insert: {
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string | null
          document_number?: string | null
          document_type?: string | null
          dream_goal?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          is_active?: boolean | null
          is_admin?: boolean | null
          kyc_status?: string | null
          phone: string
          rank?: string | null
          referred_by?: string | null
          spark_link_code?: string | null
          streak_count?: number | null
          total_cycles?: number | null
        }
        Update: {
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string | null
          document_number?: string | null
          document_type?: string | null
          dream_goal?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          is_active?: boolean | null
          is_admin?: boolean | null
          kyc_status?: string | null
          phone?: string
          rank?: string | null
          referred_by?: string | null
          spark_link_code?: string | null
          streak_count?: number | null
          total_cycles?: number | null
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
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          location: string
          name: string
          projected_return_pct: number | null
          property_type: string
          raised_amount: number | null
          status: string | null
          target_amount: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location: string
          name: string
          projected_return_pct?: number | null
          property_type: string
          raised_amount?: number | null
          status?: string | null
          target_amount: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string
          name?: string
          projected_return_pct?: number | null
          property_type?: string
          raised_amount?: number | null
          status?: string | null
          target_amount?: number
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
      reit_units: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          price_per_unit: number
          property_id: string | null
          total_paid: number
          units: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          price_per_unit: number
          property_id?: string | null
          total_paid: number
          units: number
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          price_per_unit?: number
          property_id?: string | null
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
      spark_trade_shortlist: {
        Row: {
          added_at: string | null
          amazon_fee: number | null
          asin: string
          category: string | null
          estimated_margin: number | null
          id: string
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
          estimated_margin?: number | null
          id?: string
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
          estimated_margin?: number | null
          id?: string
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
      [_ in never]: never
    }
    Functions: {
      increment_ubuntu_fund: {
        Args: { contribution: number }
        Returns: undefined
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      join_spark_trade: { Args: { _id: string }; Returns: undefined }
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
