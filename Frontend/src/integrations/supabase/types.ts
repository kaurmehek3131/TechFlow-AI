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
      lessons: {
        Row: {
          answer_key: string | null
          created_at: string
          duration: string | null
          grade: string | null
          homework: string | null
          id: string
          is_published: boolean
          language: string | null
          lesson_plan: string | null
          objectives: string | null
          quiz: string | null
          rubric: string | null
          shares_count: number
          subject: string | null
          title: string
          topic: string | null
          short_summary: string | null
          revision_notes: string | null
          exam_notes: string | null
          one_minute_review: string | null
          generated_questions: string | null
          blooms_taxonomy: string | null
          teaching_suggestions: string | null
          updated_at: string
          user_id: string
          views_count: number
          worksheet: string | null
        }
        Insert: {
          answer_key?: string | null
          created_at?: string
          duration?: string | null
          grade?: string | null
          homework?: string | null
          id?: string
          is_published?: boolean
          language?: string | null
          lesson_plan?: string | null
          objectives?: string | null
          quiz?: string | null
          rubric?: string | null
          shares_count?: number
          subject?: string | null
          title: string
          topic?: string | null
          short_summary?: string | null
          revision_notes?: string | null
          exam_notes?: string | null
          one_minute_review?: string | null
          generated_questions?: string | null
          blooms_taxonomy?: string | null
          teaching_suggestions?: string | null
          updated_at?: string
          user_id: string
          views_count?: number
          worksheet?: string | null
        }
        Update: {
          answer_key?: string | null
          created_at?: string
          duration?: string | null
          grade?: string | null
          homework?: string | null
          id?: string
          is_published?: boolean
          language?: string | null
          lesson_plan?: string | null
          objectives?: string | null
          quiz?: string | null
          rubric?: string | null
          shares_count?: number
          subject?: string | null
          title?: string
          topic?: string | null
          short_summary?: string | null
          revision_notes?: string | null
          exam_notes?: string | null
          one_minute_review?: string | null
          generated_questions?: string | null
          blooms_taxonomy?: string | null
          teaching_suggestions?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number
          worksheet?: string | null
        }
        Relationships: []
      }
      lesson_versions: {
        Row: {
          answer_key: string | null
          created_at: string
          created_by: string | null
          duration: string | null
          grade: string | null
          homework: string | null
          id: string
          language: string | null
          lesson_id: string
          lesson_plan: string | null
          objectives: string | null
          quiz: string | null
          rubric: string | null
          subject: string | null
          title: string
          topic: string | null
          version_number: number
        }
        Insert: {
          answer_key?: string | null
          created_at?: string
          created_by?: string | null
          duration?: string | null
          grade?: string | null
          homework?: string | null
          id?: string
          language?: string | null
          lesson_id: string
          lesson_plan?: string | null
          objectives?: string | null
          quiz?: string | null
          rubric?: string | null
          subject?: string | null
          title: string
          topic?: string | null
          version_number: number
        }
        Update: {
          answer_key?: string | null
          created_at?: string
          created_by?: string | null
          duration?: string | null
          grade?: string | null
          homework?: string | null
          id?: string
          language?: string | null
          lesson_id?: string
          lesson_plan?: string | null
          objectives?: string | null
          quiz?: string | null
          rubric?: string | null
          subject?: string | null
          title?: string
          topic?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_versions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          preferred_language: string | null
          preferred_theme: string | null
          role: Database["public"]["Enums"]["user_role"]
          school: string | null
          subject_specialty: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferred_language?: string | null
          preferred_theme?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school?: string | null
          subject_specialty?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_language?: string | null
          preferred_theme?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school?: string | null
          subject_specialty?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          id: string
          lesson_id: string
          teacher_id: string
          title: string
          due_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          teacher_id: string
          title: string
          due_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          teacher_id?: string
          title?: string
          due_date?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      submissions: {
        Row: {
          id: string
          assignment_id: string
          student_id: string
          submitted_at: string
          answers: string
          score: number | null
          status: string
          feedback: string | null
        }
        Insert: {
          id?: string
          assignment_id: string
          student_id: string
          submitted_at?: string
          answers: string
          score?: number | null
          status?: string
          feedback?: string | null
        }
        Update: {
          id?: string
          assignment_id?: string
          student_id?: string
          submitted_at?: string
          answers?: string
          score?: number | null
          status?: string
          feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      student_progress: {
        Row: {
          id: string
          student_id: string
          lesson_id: string
          completed_at: string
          quiz_score: number | null
          quiz_total: number | null
        }
        Insert: {
          id?: string
          student_id: string
          lesson_id: string
          completed_at?: string
          quiz_score?: number | null
          quiz_total?: number | null
        }
        Update: {
          id?: string
          student_id?: string
          lesson_id?: string
          completed_at?: string
          quiz_score?: number | null
          quiz_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      badges: {
        Row: {
          id: string
          student_id: string
          badge_type: string
          awarded_at: string
        }
        Insert: {
          id?: string
          student_id: string
          badge_type: string
          awarded_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          badge_type?: string
          awarded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      learning_recommendations: {
        Row: {
          id: string
          student_id: string
          recommendations: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          recommendations: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          recommendations?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      study_plans: {
        Row: {
          id: string
          student_id: string
          schedule: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          schedule: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          schedule?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      tutor_chats: {
        Row: {
          id: string
          student_id: string
          lesson_id: string
          message: string
          response: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          lesson_id: string
          message: string
          response: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          lesson_id?: string
          message?: string
          response?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_chats_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_chats_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: "teacher" | "student"
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
    Enums: {
      user_role: ["teacher", "student"],
    },
  },
} as const
