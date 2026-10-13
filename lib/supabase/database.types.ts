// Mirrors supabase/schema.sql. Regenerate with `npx supabase gen types typescript`
// if you change the schema.

import type { BudgetCategory, Category, Kind } from '../finance'

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
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
