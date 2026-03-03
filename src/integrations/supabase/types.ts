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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_google_credentials: {
        Row: {
          admin_email: string
          created_at: string
          domain: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          id: string
          last_used_at: string | null
          rotation_count: number | null
          scopes: string[]
          security_flags: Json | null
          token_expires_at: string
          token_version: number | null
          updated_at: string
        }
        Insert: {
          admin_email: string
          created_at?: string
          domain: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          last_used_at?: string | null
          rotation_count?: number | null
          scopes?: string[]
          security_flags?: Json | null
          token_expires_at: string
          token_version?: number | null
          updated_at?: string
        }
        Update: {
          admin_email?: string
          created_at?: string
          domain?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          last_used_at?: string | null
          rotation_count?: number | null
          scopes?: string[]
          security_flags?: Json | null
          token_expires_at?: string
          token_version?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      booked_appointment_settings: {
        Row: {
          buffer_time_minutes: number | null
          created_at: string
          guests_can_invite_others: boolean
          id: string
          is_active: boolean
          max_bookings_per_day: number | null
          updated_at: string
        }
        Insert: {
          buffer_time_minutes?: number | null
          created_at?: string
          guests_can_invite_others?: boolean
          id?: string
          is_active?: boolean
          max_bookings_per_day?: number | null
          updated_at?: string
        }
        Update: {
          buffer_time_minutes?: number | null
          created_at?: string
          guests_can_invite_others?: boolean
          id?: string
          is_active?: boolean
          max_bookings_per_day?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_page_settings: {
        Row: {
          created_at: string
          id: string
          logo_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          created_at: string
          friday_end: string | null
          friday_start: string | null
          id: string
          is_active: boolean
          monday_end: string | null
          monday_start: string | null
          name: string
          saturday_end: string | null
          saturday_start: string | null
          sunday_end: string | null
          sunday_start: string | null
          thursday_end: string | null
          thursday_start: string | null
          time_format: string | null
          timezone: string
          tuesday_end: string | null
          tuesday_start: string | null
          updated_at: string
          wednesday_end: string | null
          wednesday_start: string | null
        }
        Insert: {
          created_at?: string
          friday_end?: string | null
          friday_start?: string | null
          id?: string
          is_active?: boolean
          monday_end?: string | null
          monday_start?: string | null
          name?: string
          saturday_end?: string | null
          saturday_start?: string | null
          sunday_end?: string | null
          sunday_start?: string | null
          thursday_end?: string | null
          thursday_start?: string | null
          time_format?: string | null
          timezone?: string
          tuesday_end?: string | null
          tuesday_start?: string | null
          updated_at?: string
          wednesday_end?: string | null
          wednesday_start?: string | null
        }
        Update: {
          created_at?: string
          friday_end?: string | null
          friday_start?: string | null
          id?: string
          is_active?: boolean
          monday_end?: string | null
          monday_start?: string | null
          name?: string
          saturday_end?: string | null
          saturday_start?: string | null
          sunday_end?: string | null
          sunday_start?: string | null
          thursday_end?: string | null
          thursday_start?: string | null
          time_format?: string | null
          timezone?: string
          tuesday_end?: string | null
          tuesday_start?: string | null
          updated_at?: string
          wednesday_end?: string | null
          wednesday_start?: string | null
        }
        Relationships: []
      }
      client_team_business_hours: {
        Row: {
          client_team_id: string
          created_at: string
          friday_end: string | null
          friday_start: string | null
          id: string
          is_active: boolean
          monday_end: string | null
          monday_start: string | null
          saturday_end: string | null
          saturday_start: string | null
          sunday_end: string | null
          sunday_start: string | null
          thursday_end: string | null
          thursday_start: string | null
          time_format: string | null
          timezone: string
          tuesday_end: string | null
          tuesday_start: string | null
          updated_at: string
          wednesday_end: string | null
          wednesday_start: string | null
        }
        Insert: {
          client_team_id: string
          created_at?: string
          friday_end?: string | null
          friday_start?: string | null
          id?: string
          is_active?: boolean
          monday_end?: string | null
          monday_start?: string | null
          saturday_end?: string | null
          saturday_start?: string | null
          sunday_end?: string | null
          sunday_start?: string | null
          thursday_end?: string | null
          thursday_start?: string | null
          time_format?: string | null
          timezone: string
          tuesday_end?: string | null
          tuesday_start?: string | null
          updated_at?: string
          wednesday_end?: string | null
          wednesday_start?: string | null
        }
        Update: {
          client_team_id?: string
          created_at?: string
          friday_end?: string | null
          friday_start?: string | null
          id?: string
          is_active?: boolean
          monday_end?: string | null
          monday_start?: string | null
          saturday_end?: string | null
          saturday_start?: string | null
          sunday_end?: string | null
          sunday_start?: string | null
          thursday_end?: string | null
          thursday_start?: string | null
          time_format?: string | null
          timezone?: string
          tuesday_end?: string | null
          tuesday_start?: string | null
          updated_at?: string
          wednesday_end?: string | null
          wednesday_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_team_business_hours_client_team_id_fkey"
            columns: ["client_team_id"]
            isOneToOne: true
            referencedRelation: "client_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      client_teams: {
        Row: {
          booking_slug: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          booking_slug?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          booking_slug?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_credentials_audit_log: {
        Row: {
          action: string
          created_at: string
          credential_id: string | null
          edge_function_name: string | null
          error_message: string | null
          id: string
          ip_address: unknown | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          credential_id?: string | null
          edge_function_name?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          credential_id?: string | null
          edge_function_name?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_credentials_audit_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "admin_google_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_settings: {
        Row: {
          created_at: string
          cta_text: string
          default_client_team_slug: string | null
          footer_copyright_text: string | null
          hero_description: string
          hero_title: string
          id: string
          is_active: boolean
          logo_link: string | null
          show_features: boolean
          show_how_it_works: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_text?: string
          default_client_team_slug?: string | null
          footer_copyright_text?: string | null
          hero_description?: string
          hero_title?: string
          id?: string
          is_active?: boolean
          logo_link?: string | null
          show_features?: boolean
          show_how_it_works?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_text?: string
          default_client_team_slug?: string | null
          footer_copyright_text?: string | null
          hero_description?: string
          hero_title?: string
          id?: string
          is_active?: boolean
          logo_link?: string | null
          show_features?: boolean
          show_how_it_works?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          attendee_emails: string[]
          client_team_id: string | null
          created_at: string
          description: string | null
          end_time: string
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          organizer_email: string
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attendee_emails?: string[]
          client_team_id?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          organizer_email: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attendee_emails?: string[]
          client_team_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          organizer_email?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_team_id_fkey"
            columns: ["client_team_id"]
            isOneToOne: false
            referencedRelation: "client_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          state: string
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          provider: string
          state: string
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          state?: string
          user_email?: string
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
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduling_window_settings: {
        Row: {
          availability_type: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          max_advance_days: number | null
          min_notice_hours: number | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          availability_type?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_advance_days?: number | null
          min_notice_hours?: number | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          availability_type?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_advance_days?: number | null
          min_notice_hours?: number | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_member_client_teams: {
        Row: {
          client_team_id: string
          created_at: string
          id: string
          team_member_id: string
        }
        Insert: {
          client_team_id: string
          created_at?: string
          id?: string
          team_member_id: string
        }
        Update: {
          client_team_id?: string
          created_at?: string
          id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_client_teams_client_team_id_fkey"
            columns: ["client_team_id"]
            isOneToOne: false
            referencedRelation: "client_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_client_teams_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          booking_slug: string | null
          created_at: string
          email: string
          google_calendar_id: string | null
          google_photo_url: string | null
          google_profile_data: Json | null
          id: string
          is_active: boolean
          name: string
          role: string
          role_id: string
          updated_at: string
        }
        Insert: {
          booking_slug?: string | null
          created_at?: string
          email: string
          google_calendar_id?: string | null
          google_photo_url?: string | null
          google_profile_data?: Json | null
          id?: string
          is_active?: boolean
          name: string
          role: string
          role_id: string
          updated_at?: string
        }
        Update: {
          booking_slug?: string | null
          created_at?: string
          email?: string
          google_calendar_id?: string | null
          google_photo_url?: string | null
          google_profile_data?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          role?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "member_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_booking_display: {
        Row: {
          logo_url: string | null
        }
        Relationships: []
      }
      public_landing_display: {
        Row: {
          cta_text: string | null
          hero_description: string | null
          hero_title: string | null
          show_features: boolean | null
          show_how_it_works: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_meeting: {
        Args: { meeting_id: string; user_email: string }
        Returns: boolean
      }
      encrypt_token: {
        Args: { token: string }
        Returns: string
      }
      get_team_members_with_roles: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          google_calendar_id: string
          google_photo_url: string
          google_profile_data: Json
          id: string
          is_active: boolean
          name: string
          role_description: string
          role_id: string
          role_name: string
          updated_at: string
        }[]
      }
      rotate_google_credentials: {
        Args: {
          credential_id_param: string
          new_encrypted_access_token: string
          new_encrypted_refresh_token: string
          new_expires_at: string
        }
        Returns: boolean
      }
      simple_audit_log: {
        Args: { action_type: string; record_id?: string; table_name: string }
        Returns: undefined
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
