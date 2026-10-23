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
      adjustments: {
        Row: {
          adjustment_date: string
          amount: number
          approved_by: string | null
          bill_id: string
          created_at: string
          id: string
          idempotency_key: string | null
          reason: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          type: Database["public"]["Enums"]["adjustment_type"]
        }
        Insert: {
          adjustment_date?: string
          amount: number
          approved_by?: string | null
          bill_id: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          reason: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          type: Database["public"]["Enums"]["adjustment_type"]
        }
        Update: {
          adjustment_date?: string
          amount?: number
          approved_by?: string | null
          bill_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          reason?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          type?: Database["public"]["Enums"]["adjustment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_summary"
            referencedColumns: ["bill_id"]
          },
          {
            foreignKeyName: "adjustments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_bootstrap: {
        Row: {
          claimed: boolean
          id: boolean
        }
        Insert: {
          claimed?: boolean
          id?: boolean
        }
        Update: {
          claimed?: boolean
          id?: boolean
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      banks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          short_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          short_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          short_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bill_items: {
        Row: {
          amount: number | null
          bill_id: string
          category: Database["public"]["Enums"]["charge_category"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          quantity: number
          rate: number
        }
        Insert: {
          amount?: number | null
          bill_id: string
          category: Database["public"]["Enums"]["charge_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          quantity?: number
          rate: number
        }
        Update: {
          amount?: number | null
          bill_id?: string
          category?: Database["public"]["Enums"]["charge_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          quantity?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_summary"
            referencedColumns: ["bill_id"]
          },
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_date: string
          bill_no: string
          created_at: string
          created_by: string | null
          creation_key: string | null
          id: string
          import_batch_id: string | null
          opinion_id: string
          remarks: string | null
          status: Database["public"]["Enums"]["bill_status"]
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bill_date?: string
          bill_no: string
          created_at?: string
          created_by?: string | null
          creation_key?: string | null
          id?: string
          import_batch_id?: string | null
          opinion_id: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bill_date?: string
          bill_no?: string
          created_at?: string
          created_by?: string | null
          creation_key?: string | null
          id?: string
          import_batch_id?: string | null
          opinion_id?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_opinion_id_fkey"
            columns: ["opinion_id"]
            isOneToOne: false
            referencedRelation: "opinions"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          active: boolean
          bank_id: string
          city: string | null
          contact: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bank_id: string
          city?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bank_id?: string
          city?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_notes: {
        Row: {
          bill_id: string
          created_at: string
          created_by: string | null
          id: string
          next_followup_date: string | null
          note: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          next_followup_date?: string | null
          note: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          next_followup_date?: string | null
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_notes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_summary"
            referencedColumns: ["bill_id"]
          },
          {
            foreignKeyName: "followup_notes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          accepted_rows: number
          created_at: string
          created_by: string | null
          file_fingerprint: string | null
          file_name: string
          id: string
          mapping: Json | null
          rejected_rows: number
          sheet_name: string | null
          total_rows: number
        }
        Insert: {
          accepted_rows?: number
          created_at?: string
          created_by?: string | null
          file_fingerprint?: string | null
          file_name: string
          id?: string
          mapping?: Json | null
          rejected_rows?: number
          sheet_name?: string | null
          total_rows?: number
        }
        Update: {
          accepted_rows?: number
          created_at?: string
          created_by?: string | null
          file_fingerprint?: string | null
          file_name?: string
          id?: string
          mapping?: Json | null
          rejected_rows?: number
          sheet_name?: string | null
          total_rows?: number
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          batch_id: string
          bill_id: string | null
          id: string
          messages: string[] | null
          opinion_id: string | null
          raw: Json | null
          row_number: number
          status: string
        }
        Insert: {
          batch_id: string
          bill_id?: string | null
          id?: string
          messages?: string[] | null
          opinion_id?: string | null
          raw?: Json | null
          row_number: number
          status: string
        }
        Update: {
          batch_id?: string
          bill_id?: string | null
          id?: string
          messages?: string[] | null
          opinion_id?: string | null
          raw?: Json | null
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_summary"
            referencedColumns: ["bill_id"]
          },
          {
            foreignKeyName: "import_rows_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_opinion_id_fkey"
            columns: ["opinion_id"]
            isOneToOne: false
            referencedRelation: "opinions"
            referencedColumns: ["id"]
          },
        ]
      }
      opinion_documents: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          opinion_id: string
          received_date: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opinion_id: string
          received_date?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opinion_id?: string
          received_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "opinion_documents_opinion_id_fkey"
            columns: ["opinion_id"]
            isOneToOne: false
            referencedRelation: "opinions"
            referencedColumns: ["id"]
          },
        ]
      }
      opinions: {
        Row: {
          assigned_to: string | null
          bank_id: string
          borrower_name: string
          branch_id: string
          created_at: string
          created_by: string | null
          docs_description: string | null
          docs_received_date: string | null
          id: string
          import_batch_id: string | null
          opinion_no: string
          remarks: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["opinion_status"]
          submission_date: string | null
          submission_ref: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          bank_id: string
          borrower_name: string
          branch_id: string
          created_at?: string
          created_by?: string | null
          docs_description?: string | null
          docs_received_date?: string | null
          id?: string
          import_batch_id?: string | null
          opinion_no: string
          remarks?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["opinion_status"]
          submission_date?: string | null
          submission_ref?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          bank_id?: string
          borrower_name?: string
          branch_id?: string
          created_at?: string
          created_by?: string | null
          docs_description?: string | null
          docs_received_date?: string | null
          id?: string
          import_batch_id?: string | null
          opinion_no?: string
          remarks?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["opinion_status"]
          submission_date?: string | null
          submission_ref?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opinions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opinions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opinions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reversals: {
        Row: {
          created_at: string
          id: string
          payment_id: string
          reason: string
          reversed_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id: string
          reason: string
          reversed_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string
          reason?: string
          reversed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reversals_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          idempotency_key: string
          is_historical: boolean
          method: string | null
          payment_date: string
          recorded_by: string | null
          reference: string | null
          remarks: string | null
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          is_historical?: boolean
          method?: string | null
          payment_date: string
          recorded_by?: string | null
          reference?: string | null
          remarks?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          is_historical?: boolean
          method?: string | null
          payment_date?: string
          recorded_by?: string | null
          reference?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_summary"
            referencedColumns: ["bill_id"]
          },
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      bill_summary: {
        Row: {
          adjusted: number | null
          bank_id: string | null
          bank_name: string | null
          bill_date: string | null
          bill_id: string | null
          bill_no: string | null
          bill_status: Database["public"]["Enums"]["bill_status"] | null
          borrower_name: string | null
          branch_id: string | null
          branch_name: string | null
          created_at: string | null
          historical_received: number | null
          last_payment_date: string | null
          opinion_id: string | null
          opinion_no: string | null
          opinion_status: Database["public"]["Enums"]["opinion_status"] | null
          outstanding: number | null
          payment_status: string | null
          received: number | null
          remarks: string | null
          service_type: string | null
          submission_date: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_opinion_id_fkey"
            columns: ["opinion_id"]
            isOneToOne: false
            referencedRelation: "opinions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opinions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opinions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_adjustment: {
        Args: {
          _amount: number
          _bill_id: string
          _date: string
          _idempotency_key: string
          _reason: string
          _type: Database["public"]["Enums"]["adjustment_type"]
        }
        Returns: string
      }
      bill_adjusted: { Args: { _bill: string }; Returns: number }
      bill_received: { Args: { _bill: string }; Returns: number }
      can_edit_bill: { Args: { _bill: string }; Returns: boolean }
      commit_import: {
        Args: {
          _file_name: string
          _fingerprint: string
          _mapping: Json
          _rows: Json
          _sheet: string
        }
        Returns: string
      }
      create_bank_with_branches: {
        Args: { _branches: Json; _name: string; _short_code: string }
        Returns: string
      }

      create_bill: {
        Args: {
          _allow_additional?: boolean
          _bill_date: string
          _finalize: boolean
          _items: Json
          _key: string
          _opinion_id: string
          _remarks: string
          _submission_status: string
          _submission_date: string | null
          _submission_ref: string | null
        }
        Returns: string
      }

      has_perm: {
        Args: {
          _perm: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _user_id: string }; Returns: boolean }
      record_payment: {
        Args: {
          _amount: number
          _bill_id: string
          _idempotency_key: string
          _kind: string
          _method: string
          _payment_date: string
          _reference: string
          _remarks: string
          _settlement_reason?: string
        }
        Returns: Json
      }
      reverse_adjustment: {
        Args: { _adjustment_id: string; _reason: string }
        Returns: undefined
      }
      reverse_payment: {
        Args: { _payment_id: string; _reason: string }
        Returns: undefined
      }
    }
    Enums: {
      adjustment_type: "discount" | "write_off" | "settlement"
      app_permission:
      | "record_payments"
      | "approve_adjustments"
      | "reverse_payments"
      | "manage_masters"
      | "import_records"
      app_role: "admin" | "staff"
      bill_status: "draft" | "finalized"
      charge_category:
      | "legal_opinion"
      | "ec"
      | "single_search"
      | "document"
      | "other"
      | "custom"
      opinion_status:
      | "received"
      | "in_progress"
      | "ready"
      | "submitted"
      | "on_hold"
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
    Enums: {
      adjustment_type: ["discount", "write_off", "settlement"],
      app_permission: [
        "record_payments",
        "approve_adjustments",
        "reverse_payments",
        "manage_masters",
        "import_records",
      ],
      app_role: ["admin", "staff"],
      bill_status: ["draft", "finalized"],
      charge_category: [
        "legal_opinion",
        "ec",
        "single_search",
        "document",
        "other",
        "custom",
      ],
      opinion_status: [
        "received",
        "in_progress",
        "ready",
        "submitted",
        "on_hold",
      ],
    },
  },
} as const
