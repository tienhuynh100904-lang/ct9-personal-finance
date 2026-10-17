// Mirrors supabase/schema.sql. Regenerate with `npx supabase gen types typescript`
// if you change the schema.

import type { BudgetCategory, Category, Kind } from '../finance'
import type { GoalKind, GoalPlace } from '../goals'

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string
          user_id: string
          kind: Kind
          item: string
          category: Category
          amount: number
          occurred_on: string
          note: string | null
          from_savings: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          kind: Kind
          item: string
          category: Category
          amount: number
          occurred_on: string
          note?: string | null
          from_savings?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: Kind
          item?: string
          category?: Category
          amount?: number
          occurred_on?: string
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          user_id: string
          year: number
          month: number
          category: BudgetCategory
          amount: number
          updated_at: string
        }
        Insert: {
          user_id?: string
          year: number
          month: number
          category: BudgetCategory
          amount?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          year?: number
          month?: number
          category?: BudgetCategory
          amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          id: string
          user_id: string
          kind: Kind
          name: string
          default_category: Category | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          kind: Kind
          name: string
          default_category?: Category | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: Kind
          name?: string
          default_category?: Category | null
          created_at?: string
        }
        Relationships: []
      }
      day_marks: {
        Row: {
          user_id: string
          day: string
          kind: 'no_spend'
          created_at: string
        }
        Insert: {
          user_id?: string
          day: string
          kind?: 'no_spend'
          created_at?: string
        }
        Update: {
          user_id?: string
          day?: string
          kind?: 'no_spend'
          created_at?: string
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          user_id: string
          enabled: boolean
          remind_at: string
          last_sent_on: string | null
          last_message: number | null
          updated_at: string
        }
        Insert: {
          user_id?: string
          enabled?: boolean
          remind_at?: string
          last_sent_on?: string | null
          last_message?: number | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          enabled?: boolean
          remind_at?: string
          last_sent_on?: string | null
          last_message?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          id: string
          user_id: string
          kind: Kind
          item: string
          category: Category
          amount: number
          day_of_month: number
          note: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          kind: Kind
          item: string
          category: Category
          amount: number
          day_of_month: number
          note?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: Kind
          item?: string
          category?: Category
          amount?: number
          day_of_month?: number
          note?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_runs: {
        Row: {
          recurring_id: string
          user_id: string
          year: number
          month: number
          status: 'done' | 'skipped'
          transaction_id: string | null
          created_at: string
        }
        Insert: {
          recurring_id: string
          user_id?: string
          year: number
          month: number
          status: 'done' | 'skipped'
          transaction_id?: string | null
          created_at?: string
        }
        Update: {
          recurring_id?: string
          user_id?: string
          year?: number
          month?: number
          status?: 'done' | 'skipped'
          transaction_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          user_id: string
          kind: GoalKind
          name: string
          target_amount: number
          monthly_expense: number | null
          reserve_months: number | null
          start_date: string
          months: number
          rate_bp: number
          place: GoalPlace
          initial_amount: number
          note: string | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          kind?: GoalKind
          name: string
          target_amount: number
          monthly_expense?: number | null
          reserve_months?: number | null
          start_date: string
          months: number
          rate_bp?: number
          place?: GoalPlace
          initial_amount?: number
          note?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: GoalKind
          name?: string
          target_amount?: number
          monthly_expense?: number | null
          reserve_months?: number | null
          start_date?: string
          months?: number
          rate_bp?: number
          place?: GoalPlace
          initial_amount?: number
          note?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      goal_allocations: {
        Row: {
          id: string
          user_id: string
          goal_id: string
          amount: number
          allocated_on: string
          note: string | null
          created_at: string
          transaction_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          goal_id: string
          amount: number
          allocated_on: string
          note?: string | null
          created_at?: string
          transaction_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          goal_id?: string
          amount?: number
          allocated_on?: string
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      item_usage: {
        Row: {
          user_id: string
          kind: Kind
          item: string
          uses: number
          last_used_on: string
          last_category: Category
        }
        Relationships: []
      }
      savings_pool: {
        Row: {
          saved: number
          allocated: number
          spent: number
        }
        Relationships: []
      }
    }
    Functions: {
      rename_item: {
        Args: {
          p_kind: string
          p_old_name: string
          p_new_name: string
          p_update_transactions?: boolean
        }
        Returns: undefined
      }
      confirm_recurring: {
        Args: {
          p_recurring_id: string
          p_year: number
          p_month: number
          p_amount: number
          p_occurred_on: string
        }
        Returns: string
      }
      allocate_savings: {
        Args: {
          p_items: { goal_id: string; amount: number }[]
          p_on: string
          p_note?: string | null
        }
        Returns: undefined
      }
      spend_from_goal: {
        Args: {
          p_goal_id: string
          p_amount: number
          p_item: string
          p_category: string
          p_occurred_on: string
          p_note?: string | null
        }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
