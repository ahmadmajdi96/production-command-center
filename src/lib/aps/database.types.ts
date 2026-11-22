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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      approvals: {
        Row: {
          comment: string | null
          decision: string
          id: string
          meaning: string
          signed_at: string
          signer_email: string
          signer_name: string | null
          version_id: string
        }
        Insert: {
          comment?: string | null
          decision: string
          id?: string
          meaning: string
          signed_at?: string
          signer_email: string
          signer_name?: string | null
          version_id: string
        }
        Update: {
          comment?: string | null
          decision?: string
          id?: string
          meaning?: string
          signed_at?: string
          signer_email?: string
          signer_name?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string
          after_value: Json | null
          at: string
          before_value: Json | null
          entity: string
          entity_id: string | null
          hash: string | null
          id: string
          prev_hash: string | null
          reason: string | null
          seq: number
        }
        Insert: {
          action: string
          actor: string
          after_value?: Json | null
          at?: string
          before_value?: Json | null
          entity: string
          entity_id?: string | null
          hash?: string | null
          id?: string
          prev_hash?: string | null
          reason?: string | null
          seq?: never
        }
        Update: {
          action?: string
          actor?: string
          after_value?: Json | null
          at?: string
          before_value?: Json | null
          entity?: string
          entity_id?: string | null
          hash?: string | null
          id?: string
          prev_hash?: string | null
          reason?: string | null
          seq?: never
        }
        Relationships: []
      }
      business_rules: {
        Row: {
          active: boolean
          code: string | null
          conflict_policy: string | null
          criterion: string
          description: string | null
          direction: string
          domain: string
          id: string
          name: string
          rule_priority: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code?: string | null
          conflict_policy?: string | null
          criterion: string
          description?: string | null
          direction?: string
          domain?: string
          id?: string
          name: string
          rule_priority?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string | null
          conflict_policy?: string | null
          criterion?: string
          description?: string | null
          direction?: string
          domain?: string
          id?: string
          name?: string
          rule_priority?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      changeovers: {
        Row: {
          from_family: string
          id: string
          minutes: number
          to_family: string
        }
        Insert: {
          from_family: string
          id?: string
          minutes: number
          to_family: string
        }
        Update: {
          from_family?: string
          id?: string
          minutes?: number
          to_family?: string
        }
        Relationships: []
      }
      execution_feedback: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          good_qty: number | null
          id: string
          po_number: string
          received_at: string
          reported_at: string | null
          scrap_qty: number | null
          seq: number
          status: string
          version_no: number | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          good_qty?: number | null
          id?: string
          po_number: string
          received_at?: string
          reported_at?: string | null
          scrap_qty?: number | null
          seq: number
          status: string
          version_no?: number | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          good_qty?: number | null
          id?: string
          po_number?: string
          received_at?: string
          reported_at?: string | null
          scrap_qty?: number | null
          seq?: number
          status?: string
          version_no?: number | null
        }
        Relationships: []
      }
      integration_events: {
        Row: {
          correlation_id: string | null
          entity_id: string | null
          entity_revision: string | null
          error: string | null
          event_id: string | null
          id: string
          idempotency_key: string | null
          occurred_at: string | null
          outcome: string
          received_at: string
          records: number
          schema_version: string
          source_system: string
        }
        Insert: {
          correlation_id?: string | null
          entity_id?: string | null
          entity_revision?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          idempotency_key?: string | null
          occurred_at?: string | null
          outcome: string
          received_at?: string
          records?: number
          schema_version?: string
          source_system: string
        }
        Update: {
          correlation_id?: string | null
          entity_id?: string | null
          entity_revision?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          idempotency_key?: string | null
          occurred_at?: string | null
          outcome?: string
          received_at?: string
          records?: number
          schema_version?: string
          source_system?: string
        }
        Relationships: []
      }
      integration_sources: {
        Row: {
          data_scope: string
          key: string
          last_status: string
          last_sync_at: string | null
          name: string
          provider_system: string
          records_last_sync: number
        }
        Insert: {
          data_scope: string
          key: string
          last_status?: string
          last_sync_at?: string | null
          name: string
          provider_system: string
          records_last_sync?: number
        }
        Update: {
          data_scope?: string
          key?: string
          last_status?: string
          last_sync_at?: string | null
          name?: string
          provider_system?: string
          records_last_sync?: number
        }
        Relationships: []
      }
      machines: {
        Row: {
          code: string
          line: string
          machine_type: string
          name: string
          rate_per_hour: number
          repair_eta: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          line?: string
          machine_type: string
          name: string
          rate_per_hour?: number
          repair_eta?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          line?: string
          machine_type?: string
          name?: string
          rate_per_hour?: number
          repair_eta?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_events: {
        Row: {
          ends_at: string
          external_id: string | null
          id: string
          kind: string
          machine_code: string
          note: string | null
          starts_at: string
        }
        Insert: {
          ends_at: string
          external_id?: string | null
          id?: string
          kind?: string
          machine_code: string
          note?: string | null
          starts_at: string
        }
        Update: {
          ends_at?: string
          external_id?: string | null
          id?: string
          kind?: string
          machine_code?: string
          note?: string | null
          starts_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          as_of: string | null
          code: string
          expected_at: string | null
          expected_qty: number
          name: string
          on_hand: number
          on_hold: number
          quality_status: string
          status: string
          uom: string
          updated_at: string
        }
        Insert: {
          as_of?: string | null
          code: string
          expected_at?: string | null
          expected_qty?: number
          name: string
          on_hand?: number
          on_hold?: number
          quality_status?: string
          status?: string
          uom?: string
          updated_at?: string
        }
        Update: {
          as_of?: string | null
          code?: string
          expected_at?: string | null
          expected_qty?: number
          name?: string
          on_hand?: number
          on_hold?: number
          quality_status?: string
          status?: string
          uom?: string
          updated_at?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          available: boolean
          id: string
          name: string
          shift_name: string
          skills: string[]
          updated_at: string
        }
        Insert: {
          available?: boolean
          id?: string
          name: string
          shift_name: string
          skills?: string[]
          updated_at?: string
        }
        Update: {
          available?: boolean
          id?: string
          name?: string
          shift_name?: string
          skills?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      production_orders: {
        Row: {
          due_date: string
          id: string
          order_revision: number
          po_number: string
          priority: number
          quantity: number
          sales_order_ref: string | null
          sku: string
          source: string
          source_updated_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          due_date: string
          id?: string
          order_revision?: number
          po_number: string
          priority?: number
          quantity: number
          sales_order_ref?: string | null
          sku: string
          source?: string
          source_updated_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          due_date?: string
          id?: string
          order_revision?: number
          po_number?: string
          priority?: number
          quantity?: number
          sales_order_ref?: string | null
          sku?: string
          source?: string
          source_updated_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          bom: Json
          bom_revision: string | null
          bom_status: string
          effective_from: string | null
          name: string
          quality_hold: boolean
          quality_note: string | null
          recipe_required: boolean
          recipe_revision: string | null
          recipe_status: string
          routing: Json
          routing_revision: string | null
          routing_status: string
          setup_family: string
          sku: string
          updated_at: string
        }
        Insert: {
          bom?: Json
          bom_revision?: string | null
          bom_status?: string
          effective_from?: string | null
          name: string
          quality_hold?: boolean
          quality_note?: string | null
          recipe_required?: boolean
          recipe_revision?: string | null
          recipe_status?: string
          routing?: Json
          routing_revision?: string | null
          routing_status?: string
          setup_family?: string
          sku: string
          updated_at?: string
        }
        Update: {
          bom?: Json
          bom_revision?: string | null
          bom_status?: string
          effective_from?: string | null
          name?: string
          quality_hold?: boolean
          quality_note?: string | null
          recipe_required?: boolean
          recipe_revision?: string | null
          recipe_status?: string
          routing?: Json
          routing_revision?: string | null
          routing_status?: string
          setup_family?: string
          sku?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_versions: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          approved_at: string | null
          conflicts: Json
          created_at: string
          created_by: string
          dispatch_status: string
          feasibility: Json
          horizon_start: string
          id: string
          input_snapshot: Json | null
          items: Json
          kind: string
          metrics: Json
          parent_id: string | null
          reason: string | null
          released_at: string | null
          rules_applied: Json
          status: string
          trigger: string | null
          version_no: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          approved_at?: string | null
          conflicts?: Json
          created_at?: string
          created_by: string
          dispatch_status?: string
          feasibility?: Json
          horizon_start: string
          id?: string
          input_snapshot?: Json | null
          items?: Json
          kind?: string
          metrics?: Json
          parent_id?: string | null
          reason?: string | null
          released_at?: string | null
          rules_applied?: Json
          status?: string
          trigger?: string | null
          version_no: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          approved_at?: string | null
          conflicts?: Json
          created_at?: string
          created_by?: string
          dispatch_status?: string
          feasibility?: Json
          horizon_start?: string
          id?: string
          input_snapshot?: Json | null
          items?: Json
          kind?: string
          metrics?: Json
          parent_id?: string | null
          reason?: string | null
          released_at?: string | null
          rules_applied?: Json
          status?: string
          trigger?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_versions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_minutes: number
          break_start_hour: number | null
          days: number[]
          end_hour: number
          id: string
          name: string
          start_hour: number
        }
        Insert: {
          break_minutes?: number
          break_start_hour?: number | null
          days?: number[]
          end_hour: number
          id?: string
          name: string
          start_hour: number
        }
        Update: {
          break_minutes?: number
          break_start_hour?: number | null
          days?: number[]
          end_hour?: number
          id?: string
          name?: string
          start_hour?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audit_row_hash: {
        Args: {
          prev: string
          r: Database["public"]["Tables"]["audit_log"]["Row"]
        }
        Returns: string
      }
      verify_audit_chain: {
        Args: never
        Returns: {
          broken_seq: number
          checked: number
          ok: boolean
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
