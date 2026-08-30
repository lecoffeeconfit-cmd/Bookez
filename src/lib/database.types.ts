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
      community_preferences: {
        Row: { user_id: string; show_profile: boolean; show_current_project: boolean; show_project_title: boolean; show_genre: boolean; show_completion_percent: boolean; show_current_stage: boolean; show_current_section: boolean; show_writing_now: boolean; show_streak: boolean; show_completed_projects: boolean; created_at: string; updated_at: string };
        Insert: { user_id: string; show_profile?: boolean; show_current_project?: boolean; show_project_title?: boolean; show_genre?: boolean; show_completion_percent?: boolean; show_current_stage?: boolean; show_current_section?: boolean; show_writing_now?: boolean; show_streak?: boolean; show_completed_projects?: boolean; created_at?: string; updated_at?: string };
        Update: { user_id?: string; show_profile?: boolean; show_current_project?: boolean; show_project_title?: boolean; show_genre?: boolean; show_completion_percent?: boolean; show_current_stage?: boolean; show_current_section?: boolean; show_writing_now?: boolean; show_streak?: boolean; show_completed_projects?: boolean; updated_at?: string };
        Relationships: [];
      };
      community_profiles: {
        Row: { user_id: string; display_name: string; bio: string | null; avatar_initials: string | null; avatar_path: string | null; updated_at: string };
        Insert: { user_id: string; display_name?: string; bio?: string | null; avatar_initials?: string | null; avatar_path?: string | null; updated_at?: string };
        Update: { user_id?: string; display_name?: string; bio?: string | null; avatar_initials?: string | null; avatar_path?: string | null; updated_at?: string };
        Relationships: [];
      };
      community_projects: {
        Row: { project_id: string; user_id: string; show_in_community: boolean; show_preview: boolean; project_title: string | null; genre: string | null; project_type: string | null; description: string | null; completion_percent: number | null; stage: string | null; public_status: string | null; cover_color: string | null; cover_image_path: string | null; updated_at: string };
        Insert: { project_id: string; user_id: string; show_in_community?: boolean; show_preview?: boolean; project_title?: string | null; genre?: string | null; project_type?: string | null; description?: string | null; completion_percent?: number | null; stage?: string | null; public_status?: string | null; cover_color?: string | null; cover_image_path?: string | null; updated_at?: string };
        Update: { project_id?: string; user_id?: string; show_in_community?: boolean; show_preview?: boolean; project_title?: string | null; genre?: string | null; project_type?: string | null; description?: string | null; completion_percent?: number | null; stage?: string | null; public_status?: string | null; cover_color?: string | null; cover_image_path?: string | null; updated_at?: string };
        Relationships: [];
      };
      community_project_previews: {
        Row: { project_id: string; user_id: string; content: Json; word_count: number; updated_at: string };
        Insert: { project_id: string; user_id: string; content?: Json; word_count?: number; updated_at?: string };
        Update: { project_id?: string; user_id?: string; content?: Json; word_count?: number; updated_at?: string };
        Relationships: [{ foreignKeyName: 'community_project_previews_project_id_fkey'; columns: ['project_id']; isOneToOne: true; referencedRelation: 'projects'; referencedColumns: ['id'] }];
      };
      community_presence: {
        Row: { user_id: string; project_id: string | null; active_until: string; updated_at: string };
        Insert: { user_id: string; project_id?: string | null; active_until: string; updated_at?: string };
        Update: { user_id?: string; project_id?: string | null; active_until?: string; updated_at?: string };
        Relationships: [];
      };
      community_milestones: {
        Row: { id: string; user_id: string; project_id: string; title: string; kind: string; completed_at: string; created_at: string };
        Insert: { id?: string; user_id: string; project_id: string; title: string; kind?: string; completed_at?: string; created_at?: string };
        Update: { id?: string; user_id?: string; project_id?: string; title?: string; kind?: string; completed_at?: string; created_at?: string };
        Relationships: [];
      };
      community_reactions: {
        Row: { id: string; user_id: string; item_id: string; item_type: string; reaction_type: string; created_at: string };
        Insert: { id?: string; user_id: string; item_id: string; item_type?: string; reaction_type: string; created_at?: string };
        Update: { id?: string; user_id?: string; item_id?: string; item_type?: string; reaction_type?: string; created_at?: string };
        Relationships: [];
      };
      community_blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: { blocker_id: string; blocked_id: string; created_at?: string };
        Update: { blocker_id?: string; blocked_id?: string; created_at?: string };
        Relationships: [];
      };
      community_reports: {
        Row: { id: string; reporter_id: string; reported_user_id: string; project_id: string | null; reason: string; created_at: string };
        Insert: { id?: string; reporter_id: string; reported_user_id: string; project_id?: string | null; reason: string; created_at?: string };
        Update: { id?: string; reporter_id?: string; reported_user_id?: string; project_id?: string | null; reason?: string; created_at?: string };
        Relationships: [];
      };
      feedback_requests: {
        Row: { id: string; author_user_id: string; project_id: string | null; title: string; question: string; context: string | null; category: string; purpose: string; share_type: string; shared_content_snapshot: Json; shared_chapter_ids: Json; genre: string | null; author_display_name: string; author_visibility: string; visibility: string; allow_comments: boolean; allow_tts: boolean; spoiler_warning: boolean; target_response_count: number | null; status: string; view_count: number; created_at: string; updated_at: string; closed_at: string | null };
        Insert: { id?: string; author_user_id: string; project_id?: string | null; title: string; question: string; context?: string | null; category: string; purpose?: string; share_type: string; shared_content_snapshot?: Json; shared_chapter_ids?: Json; genre?: string | null; author_display_name?: string; author_visibility?: string; visibility?: string; allow_comments?: boolean; allow_tts?: boolean; spoiler_warning?: boolean; target_response_count?: number | null; status?: string; view_count?: number; created_at?: string; updated_at?: string; closed_at?: string | null };
        Update: { id?: string; author_user_id?: string; project_id?: string | null; title?: string; question?: string; context?: string | null; category?: string; purpose?: string; share_type?: string; shared_content_snapshot?: Json; shared_chapter_ids?: Json; genre?: string | null; author_display_name?: string; author_visibility?: string; visibility?: string; allow_comments?: boolean; allow_tts?: boolean; spoiler_warning?: boolean; target_response_count?: number | null; status?: string; view_count?: number; updated_at?: string; closed_at?: string | null };
        Relationships: [{ foreignKeyName: 'feedback_requests_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }];
      };
      feedback_responses: {
        Row: { id: string; request_id: string; responder_user_id: string; written_feedback: string | null; custom_answer: string | null; overall_rating: number | null; structured_reactions: Json; is_helpful: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; request_id: string; responder_user_id: string; written_feedback?: string | null; custom_answer?: string | null; overall_rating?: number | null; structured_reactions?: Json; is_helpful?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; request_id?: string; responder_user_id?: string; written_feedback?: string | null; custom_answer?: string | null; overall_rating?: number | null; structured_reactions?: Json; is_helpful?: boolean; updated_at?: string };
        Relationships: [{ foreignKeyName: 'feedback_responses_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'feedback_requests'; referencedColumns: ['id'] }];
      };
      feedback_replies: {
        Row: { id: string; response_id: string; author_user_id: string; body: string; created_at: string; updated_at: string };
        Insert: { id?: string; response_id: string; author_user_id: string; body: string; created_at?: string; updated_at?: string };
        Update: { id?: string; response_id?: string; author_user_id?: string; body?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'feedback_replies_response_id_fkey'; columns: ['response_id']; isOneToOne: false; referencedRelation: 'feedback_responses'; referencedColumns: ['id'] }];
      };
      feedback_reports: {
        Row: { id: string; request_id: string | null; reporter_user_id: string; reason: string; details: string | null; status: string; created_at: string };
        Insert: { id?: string; request_id?: string | null; reporter_user_id: string; reason: string; details?: string | null; status?: string; created_at?: string };
        Update: { id?: string; request_id?: string | null; reporter_user_id?: string; reason?: string; details?: string | null; status?: string };
        Relationships: [{ foreignKeyName: 'feedback_reports_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'feedback_requests'; referencedColumns: ['id'] }];
      };
      community_feedback_requests: {
        Row: { id: string; user_id: string; project_id: string; project_title: string; author_display_name: string; genre: string | null; completion_percent: number | null; stage: string | null; cover_image_path: string | null; focus: string; question: string | null; content_scope: string; content_snapshot: Json; selected_word_count: number; reading_minutes: number; listening_minutes: number; selected_item_count: number; focuses: Json; custom_question: string | null; author_visibility: string; reading_enabled: boolean; listening_enabled: boolean; passage_comments_enabled: boolean; general_feedback_enabled: boolean; response_visibility: string; response_limit: number | null; closes_at: string | null; status: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; project_id: string; project_title: string; author_display_name?: string; genre?: string | null; completion_percent?: number | null; stage?: string | null; cover_image_path?: string | null; focus?: string; question?: string | null; content_scope?: string; content_snapshot?: Json; selected_word_count?: number; reading_minutes?: number; listening_minutes?: number; selected_item_count?: number; focuses?: Json; custom_question?: string | null; author_visibility?: string; reading_enabled?: boolean; listening_enabled?: boolean; passage_comments_enabled?: boolean; general_feedback_enabled?: boolean; response_visibility?: string; response_limit?: number | null; closes_at?: string | null; status?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; project_id?: string; project_title?: string; author_display_name?: string; genre?: string | null; completion_percent?: number | null; stage?: string | null; cover_image_path?: string | null; focus?: string; question?: string | null; content_scope?: string; content_snapshot?: Json; selected_word_count?: number; reading_minutes?: number; listening_minutes?: number; selected_item_count?: number; focuses?: Json; custom_question?: string | null; author_visibility?: string; reading_enabled?: boolean; listening_enabled?: boolean; passage_comments_enabled?: boolean; general_feedback_enabled?: boolean; response_visibility?: string; response_limit?: number | null; closes_at?: string | null; status?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'community_feedback_requests_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }];
      };
      community_feedback_request_content: {
        Row: { id: string; request_id: string; item_id: string; item_title: string; item_text: string; position: number; source_type: string; created_at: string };
        Insert: { id?: string; request_id: string; item_id: string; item_title: string; item_text: string; position: number; source_type?: string; created_at?: string };
        Update: { id?: string; request_id?: string; item_id?: string; item_title?: string; item_text?: string; position?: number; source_type?: string };
        Relationships: [{ foreignKeyName: 'community_feedback_request_content_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'community_feedback_requests'; referencedColumns: ['id'] }];
      };
      community_feedback_responses: {
        Row: { id: string; request_id: string; responder_id: string; anonymous: boolean; overall_impression: string | null; strengths: string | null; unclear_sections: string | null; suggestions: string | null; question_answers: Json; additional_comments: string | null; quick_reactions: Json; status: string; is_helpful: boolean; thanked_at: string | null; archived: boolean; submitted_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; request_id: string; responder_id: string; anonymous?: boolean; overall_impression?: string | null; strengths?: string | null; unclear_sections?: string | null; suggestions?: string | null; question_answers?: Json; additional_comments?: string | null; quick_reactions?: Json; status?: string; is_helpful?: boolean; thanked_at?: string | null; archived?: boolean; submitted_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; request_id?: string; responder_id?: string; anonymous?: boolean; overall_impression?: string | null; strengths?: string | null; unclear_sections?: string | null; suggestions?: string | null; question_answers?: Json; additional_comments?: string | null; quick_reactions?: Json; status?: string; is_helpful?: boolean; thanked_at?: string | null; archived?: boolean; submitted_at?: string | null; updated_at?: string };
        Relationships: [{ foreignKeyName: 'community_feedback_responses_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'community_feedback_requests'; referencedColumns: ['id'] }];
      };
      community_feedback_replies: {
        Row: { id: string; request_id: string; response_id: string; author_id: string; body: string; created_at: string; updated_at: string };
        Insert: { id?: string; request_id: string; response_id: string; author_id: string; body: string; created_at?: string; updated_at?: string };
        Update: { id?: string; request_id?: string; response_id?: string; author_id?: string; body?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'community_feedback_replies_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'community_feedback_requests'; referencedColumns: ['id'] }, { foreignKeyName: 'community_feedback_replies_response_id_fkey'; columns: ['response_id']; isOneToOne: true; referencedRelation: 'community_feedback_responses'; referencedColumns: ['id'] }];
      };
      community_feedback_reader_responses: {
        Row: { id: string; request_id: string; response_id: string; responder_id: string; anonymous: boolean; body: string; created_at: string; updated_at: string };
        Insert: { id?: string; request_id: string; response_id: string; responder_id: string; anonymous?: boolean; body: string; created_at?: string; updated_at?: string };
        Update: { id?: string; request_id?: string; response_id?: string; responder_id?: string; anonymous?: boolean; body?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'community_feedback_reader_responses_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'community_feedback_requests'; referencedColumns: ['id'] }, { foreignKeyName: 'community_feedback_reader_responses_response_id_fkey'; columns: ['response_id']; isOneToOne: true; referencedRelation: 'community_feedback_responses'; referencedColumns: ['id'] }];
      };
      community_feedback_annotations: {
        Row: { id: string; request_id: string; response_id: string | null; responder_id: string; item_id: string; text_start: number; text_end: number; quoted_excerpt: string; comment_text: string; created_at: string };
        Insert: { id?: string; request_id: string; response_id?: string | null; responder_id: string; item_id: string; text_start: number; text_end: number; quoted_excerpt: string; comment_text: string; created_at?: string };
        Update: { id?: string; request_id?: string; response_id?: string | null; responder_id?: string; item_id?: string; text_start?: number; text_end?: number; quoted_excerpt?: string; comment_text?: string };
        Relationships: [{ foreignKeyName: 'community_feedback_annotations_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'community_feedback_requests'; referencedColumns: ['id'] }, { foreignKeyName: 'community_feedback_annotations_response_id_fkey'; columns: ['response_id']; isOneToOne: false; referencedRelation: 'community_feedback_responses'; referencedColumns: ['id'] }];
      };
      community_feedback_reader_progress: {
        Row: { request_id: string; user_id: string; item_index: number; word_offset: number; updated_at: string };
        Insert: { request_id: string; user_id: string; item_index?: number; word_offset?: number; updated_at?: string };
        Update: { request_id?: string; user_id?: string; item_index?: number; word_offset?: number; updated_at?: string };
        Relationships: [{ foreignKeyName: 'community_feedback_reader_progress_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'community_feedback_requests'; referencedColumns: ['id'] }];
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
      get_community_feed: { Args: { p_limit?: number; p_offset?: number }; Returns: Json };
      get_community_reaction_summary: { Args: { p_item_ids: string[] }; Returns: Json };
      get_community_project_preview: { Args: { p_project_id: string }; Returns: Json };
      get_feedback_requests: { Args: { p_tab?: string; p_limit?: number; p_offset?: number }; Returns: Json };
      get_feedback_request: { Args: { p_request_id: string }; Returns: Database['bookez']['Tables']['feedback_requests']['Row'][] };
      increment_feedback_view: { Args: { p_request_id: string }; Returns: number };
      mark_feedback_helpful: { Args: { p_response_id: string; p_helpful: boolean }; Returns: boolean };
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
