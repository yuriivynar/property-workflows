// Типи схеми бази. Оновлюйте разом із міграцією: готовий файл — у Summary прогону job db-check у CI
// (supabase gen types typescript --local на одноразовій базі); або npm run db:types після npx supabase link на ваш проєкт.
// Ця версія написана вручну у форматі генератора й описує таблиці й функції міграцій
// 20261012000000_profiles_and_roles.sql, 20261020115700_roles_manager_admin.sql і 20261020115705_workflow_runs.sql.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      template_sections: {
        Row: {
          id: string;
          template_id: string;
          name: string;
          position: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          name: string;
          position: number;
        };
        Update: {
          id?: string;
          template_id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      template_tasks: {
        Row: {
          id: string;
          template_id: string;
          section_id: string;
          name: string;
          is_required: boolean;
          position: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          section_id: string;
          name: string;
          is_required: boolean;
          position: number;
        };
        Update: {
          id?: string;
          template_id?: string;
          section_id?: string;
          name?: string;
          is_required?: boolean;
          position?: number;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          id: string;
          template_id: string | null;
          template_name: string;
          case_name: string;
          run_manager_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id?: string | null;
          template_name: string;
          case_name: string;
          run_manager_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string | null;
          template_name?: string;
          case_name?: string;
          run_manager_id?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      run_sections: {
        Row: {
          id: string;
          run_id: string;
          name: string;
          position: number;
        };
        Insert: {
          id?: string;
          run_id: string;
          name: string;
          position: number;
        };
        Update: {
          id?: string;
          run_id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      run_tasks: {
        Row: {
          id: string;
          run_id: string;
          section_id: string;
          name: string;
          is_required: boolean;
          position: number;
          assignee_id: string;
          status: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          section_id: string;
          name: string;
          is_required: boolean;
          position: number;
          assignee_id: string;
          status?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          section_id?: string;
          name?: string;
          is_required?: boolean;
          position?: number;
          assignee_id?: string;
          status?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      launch_run: {
        Args: {
          p_template_id: string;
          p_case_name: string;
          p_assignments?: Json;
        };
        Returns: string;
      };
      staff_directory: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          full_name: string | null;
          email: string | null;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
