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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agreement_types: {
        Row: {
          cognito_form_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          help_text: string | null
          id: string
          is_active: boolean | null
          name: string
          requires_kyc: boolean | null
        }
        Insert: {
          cognito_form_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          help_text?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_kyc?: boolean | null
        }
        Update: {
          cognito_form_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          help_text?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_kyc?: boolean | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          accessed_data: Json | null
          action: string
          admin_role: string | null
          created_at: string
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_data?: Json | null
          action: string
          admin_role?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_data?: Json | null
          action?: string
          admin_role?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blockchain_transactions: {
        Row: {
          completed_at: string | null
          contract_address: string | null
          created_at: string | null
          id: string
          status: string | null
          transaction_data: Json | null
          transaction_id: string
          transaction_type: string
          user_address: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          contract_address?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          transaction_data?: Json | null
          transaction_id: string
          transaction_type: string
          user_address?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          contract_address?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          transaction_data?: Json | null
          transaction_id?: string
          transaction_type?: string
          user_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cognito_submissions: {
        Row: {
          cognito_entry_id: string
          cognito_form_id: string
          created_at: string | null
          id: string
          processed_at: string | null
          submission_data: Json | null
          user_agreement_id: string | null
        }
        Insert: {
          cognito_entry_id: string
          cognito_form_id: string
          created_at?: string | null
          id?: string
          processed_at?: string | null
          submission_data?: Json | null
          user_agreement_id?: string | null
        }
        Update: {
          cognito_entry_id?: string
          cognito_form_id?: string
          created_at?: string | null
          id?: string
          processed_at?: string | null
          submission_data?: Json | null
          user_agreement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cognito_submissions_user_agreement_id_fkey"
            columns: ["user_agreement_id"]
            isOneToOne: false
            referencedRelation: "user_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidity_operations: {
        Row: {
          created_at: string
          fireblocks_tx_id: string | null
          id: string
          lp_tokens_received: number | null
          operation_type: string
          pool_id: string
          slippage_tolerance: string | null
          status: string
          token_a_amount: number
          token_b_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fireblocks_tx_id?: string | null
          id?: string
          lp_tokens_received?: number | null
          operation_type: string
          pool_id: string
          slippage_tolerance?: string | null
          status?: string
          token_a_amount: number
          token_b_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fireblocks_tx_id?: string | null
          id?: string
          lp_tokens_received?: number | null
          operation_type?: string
          pool_id?: string
          slippage_tolerance?: string | null
          status?: string
          token_a_amount?: number
          token_b_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_liquidity_operations_pool"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "liquidity_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidity_pools: {
        Row: {
          created_at: string
          fee_rate: string
          fireblocks_tx_id: string | null
          id: string
          initial_liquidity_a: number
          initial_liquidity_b: number
          pool_address: string | null
          pool_type: string
          status: string
          token_a: string
          token_b: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fee_rate?: string
          fireblocks_tx_id?: string | null
          id?: string
          initial_liquidity_a: number
          initial_liquidity_b: number
          pool_address?: string | null
          pool_type?: string
          status?: string
          token_a: string
          token_b: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fee_rate?: string
          fireblocks_tx_id?: string | null
          id?: string
          initial_liquidity_a?: number
          initial_liquidity_b?: number
          pool_address?: string | null
          pool_type?: string
          status?: string
          token_a?: string
          token_b?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pledges: {
        Row: {
          admin_notes: string | null
          appraisal_date: string | null
          appraised_value: number
          appraiser_license: string | null
          approved_at: string | null
          approved_by: string | null
          asset_type: string
          contract_address: string | null
          created_at: string
          description: string | null
          document_hash: string | null
          id: string
          nft_token_id: number | null
          pledge_id: number
          rejection_reason: string | null
          status: string
          token_amount: number
          token_symbol: string | null
          tx_hash: string | null
          updated_at: string
          user_address: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          appraisal_date?: string | null
          appraised_value: number
          appraiser_license?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_type: string
          contract_address?: string | null
          created_at?: string
          description?: string | null
          document_hash?: string | null
          id?: string
          nft_token_id?: number | null
          pledge_id: number
          rejection_reason?: string | null
          status?: string
          token_amount: number
          token_symbol?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_address: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          appraisal_date?: string | null
          appraised_value?: number
          appraiser_license?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_type?: string
          contract_address?: string | null
          created_at?: string
          description?: string | null
          document_hash?: string | null
          id?: string
          nft_token_id?: number | null
          pledge_id?: number
          rejection_reason?: string | null
          status?: string
          token_amount?: number
          token_symbol?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_address?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          kyc_status: string | null
          role: string | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          kyc_status?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          kyc_status?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      token_balances: {
        Row: {
          balance: number
          id: string
          token_symbol: string
          updated_at: string
          user_address: string
        }
        Insert: {
          balance?: number
          id?: string
          token_symbol: string
          updated_at?: string
          user_address: string
        }
        Update: {
          balance?: number
          id?: string
          token_symbol?: string
          updated_at?: string
          user_address?: string
        }
        Relationships: []
      }
      user_agreements: {
        Row: {
          agreement_type_id: string
          approved_at: string | null
          approved_by: string | null
          cognito_submission_id: string | null
          created_at: string
          id: string
          notes: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agreement_type_id: string
          approved_at?: string | null
          approved_by?: string | null
          cognito_submission_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agreement_type_id?: string
          approved_at?: string | null
          approved_by?: string | null
          cognito_submission_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agreements_agreement_type_id_fkey"
            columns: ["agreement_type_id"]
            isOneToOne: false
            referencedRelation: "agreement_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_pledge_secure: {
        Args: {
          p_admin_notes?: string
          p_new_status: string
          p_pledge_id: string
        }
        Returns: boolean
      }
      admin_update_pledge_status: {
        Args: {
          p_admin_notes?: string
          p_new_status: string
          p_pledge_id: string
        }
        Returns: boolean
      }
      can_access_profile: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_pledge_sensitive_emergency: {
        Args: {
          p_emergency_justification: string
          p_pledge_id: string
          p_supervisor_email: string
        }
        Returns: {
          appraised_value: number
          description: string
          document_hash: string
          emergency_access_granted_at: string
          id: string
          user_address: string
        }[]
      }
      get_pledges_admin_secure: {
        Args:
          | {
              p_access_justification: string
              p_include_financial_data?: boolean
              p_limit?: number
            }
          | { p_limit?: number; p_mask_financial_data?: boolean }
        Returns: {
          admin_notes: string
          appraised_value_display: string
          asset_type: string
          created_at: string
          description_display: string
          has_documents: boolean
          id: string
          status: string
          updated_at: string
          user_address_display: string
          user_id: string
        }[]
      }
      get_pledges_admin_view: {
        Args: { p_limit?: number; p_mask_financial_data?: boolean }
        Returns: {
          admin_notes: string
          appraised_value_masked: string
          asset_type: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_email: string
          user_id: string
        }[]
      }
      get_pledges_analytics_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_type: string
          avg_value_rounded: number
          month_num: number
          status: string
          total_count: number
          week_created: string
        }[]
      }
      get_pledges_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_type: string
          avg_appraised_value: number
          month_created: string
          pledge_count: number
          status: string
          total_appraised_value: number
        }[]
      }
      is_service_role_or_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_admin_access: {
        Args: {
          p_accessed_data?: Json
          p_action: string
          p_record_id?: string
          p_table_name: string
        }
        Returns: boolean
      }
      setup_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_pledge_status: {
        Args: { p_admin_notes?: string; p_pledge_id: string; p_status: string }
        Returns: boolean
      }
      update_user_profile: {
        Args: { p_full_name?: string; p_kyc_status?: string; p_user_id: string }
        Returns: boolean
      }
      update_user_token_balance: {
        Args: {
          p_new_balance: number
          p_token_symbol: string
          p_user_address: string
        }
        Returns: boolean
      }
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
