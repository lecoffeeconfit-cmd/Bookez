export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  bookez: {
    Tables: {
      profiles: {
        Row: { user_id: string; display_name: string | null; onboarding_completed: boolean; current_project_id: string | null; created_at: string; updated_at: string };
        Insert: { user_id: string; display_name?: string | null; onboarding_completed?: boolean; current_project_id?: string | null; created_at?: string; updated_at?: string };
        Update: { user_id?: string; display_name?: string | null; onboarding_completed?: boolean; current_project_id?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'profiles_current_project_id_fkey'; columns: ['current_project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }];
      };
      projects: {
        Row: { id: string; user_id: string; title: string; writing_type: string; target_words: number | null; target_chapters: number | null; status: string; current_word_count: number; revision: number; deleted_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; title?: string; writing_type: string; target_words?: number | null; target_chapters?: number | null; status?: string; current_word_count?: number; revision?: number; deleted_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; title?: string; writing_type?: string; target_words?: number | null; target_chapters?: number | null; status?: string; current_word_count?: number; revision?: number; deleted_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      chapters: {
        Row: { id: string; project_id: string; user_id: string; title: string; position: number; content: string; notes: string; word_count: number; target_words: number | null; status: string; revision: number; deleted_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; project_id: string; user_id: string; title: string; position: number; content?: string; notes?: string; word_count?: number; target_words?: number | null; status?: string; revision?: number; deleted_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; project_id?: string; user_id?: string; title?: string; position?: number; content?: string; notes?: string; word_count?: number; target_words?: number | null; status?: string; revision?: number; deleted_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'chapters_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }];
      };
      plan_settings: {
        Row: { id: string; project_id: string; user_id: string; writing_frequency: string | null; reminder_enabled: boolean; reminder_time: string | null; pace: string | null; planned_completion_date: string | null; words_per_session: number | null; plan_json: Json; revision: number; deleted_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; project_id: string; user_id: string; writing_frequency?: string | null; reminder_enabled?: boolean; reminder_time?: string | null; pace?: string | null; planned_completion_date?: string | null; words_per_session?: number | null; plan_json?: Json; revision?: number; deleted_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; project_id?: string; user_id?: string; writing_frequency?: string | null; reminder_enabled?: boolean; reminder_time?: string | null; pace?: string | null; planned_completion_date?: string | null; words_per_session?: number | null; plan_json?: Json; revision?: number; deleted_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'plan_settings_project_id_fkey'; columns: ['project_id']; isOneToOne: true; referencedRelation: 'projects'; referencedColumns: ['id'] }];
      };
      writing_sessions: {
        Row: { id: string; project_id: string; chapter_id: string | null; user_id: string; words_written: number; duration_seconds: number; started_at: string; ended_at: string | null; created_at: string };
        Insert: { id?: string; project_id: string; chapter_id?: string | null; user_id: string; words_written?: number; duration_seconds?: number; started_at: string; ended_at?: string | null; created_at?: string };
        Update: { id?: string; project_id?: string; chapter_id?: string | null; user_id?: string; words_written?: number; duration_seconds?: number; started_at?: string; ended_at?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: 'writing_sessions_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }, { foreignKeyName: 'writing_sessions_chapter_id_fkey'; columns: ['chapter_id']; isOneToOne: false; referencedRelation: 'chapters'; referencedColumns: ['id'] }];
      };
    };
    Views: {};
    Functions: {
      update_project_if_revision: {
        Args: { p_id: string; p_user_id: string; p_expected_revision: number; p_title: string; p_writing_type: string; p_target_words: number | null; p_target_chapters: number | null; p_status: string; p_current_word_count: number; p_deleted_at?: string | null };
        Returns: Database['bookez']['Tables']['projects']['Row'];
      };
      update_chapter_if_revision: {
        Args: { p_id: string; p_project_id: string; p_user_id: string; p_expected_revision: number; p_title: string; p_position: number; p_content: string; p_notes: string; p_word_count: number; p_target_words: number | null; p_status: string; p_deleted_at?: string | null };
        Returns: Database['bookez']['Tables']['chapters']['Row'];
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};

export type BookezTable = keyof Database['bookez']['Tables'];
export type BookezRow<T extends BookezTable> = Database['bookez']['Tables'][T]['Row'];
export type BookezInsert<T extends BookezTable> = Database['bookez']['Tables'][T]['Insert'];
export type BookezUpdate<T extends BookezTable> = Database['bookez']['Tables'][T]['Update'];
