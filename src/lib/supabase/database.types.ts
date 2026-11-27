
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_requests": {
                  Row: {
                    "created_at": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string | null,"full_name": string | null,"id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"role"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"run_document_values": {
                  Row: {
                    "confirmed_at": string,"confirmed_by": string,"fields": NonNullable<Json>,"id": string,"kind": string,"run_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string,"confirmed_by"?: string,"fields": NonNullable<Json>,"id"?: string,"kind": string,"run_id": string
                  }
                  Update: {
                    "confirmed_at"?: string,"confirmed_by"?: string,"fields"?: NonNullable<Json>,"id"?: string,"kind"?: string,"run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_document_values_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_document_values_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "run_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_document_values_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"run_events": {
                  Row: {
                    "actor_id": string | null,"answer": string | null,"created_at": string,"field_id": string | null,"id": number,"kind": string,"run_id": string,"task_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"answer"?: string | null,"created_at"?: string,"field_id"?: string | null,"id"?: never,"kind": string,"run_id": string,"task_id"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"answer"?: string | null,"created_at"?: string,"field_id"?: string | null,"id"?: never,"kind"?: string,"run_id"?: string,"task_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_events_field_id_fkey"
      columns: ["field_id"]
isOneToOne: false
      referencedRelation: "run_fields"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_events_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "run_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_events_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_events_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "run_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"run_fields": {
                  Row: {
                    "answer": string | null,"id": string,"name": string,"options": (string)[],"position": number,"run_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: string | null,"id"?: string,"name": string,"options": (string)[],"position": number,"run_id": string
                  }
                  Update: {
                    "answer"?: string | null,"id"?: string,"name"?: string,"options"?: (string)[],"position"?: number,"run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_fields_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "run_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_fields_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"run_sections": {
                  Row: {
                    "id": string,"name": string,"position": number,"run_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"position": number,"run_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"position"?: number,"run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_sections_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "run_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_sections_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"run_tasks": {
                  Row: {
                    "assignee_id": string,"id": string,"is_required": boolean,"is_shown": boolean,"name": string,"position": number,"run_id": string,"section_id": string,"show_when_field_id": string | null,"show_when_value": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id": string,"id"?: string,"is_required": boolean,"is_shown"?: boolean,"name": string,"position": number,"run_id": string,"section_id": string,"show_when_field_id"?: string | null,"show_when_value"?: string | null,"status"?: string
                  }
                  Update: {
                    "assignee_id"?: string,"id"?: string,"is_required"?: boolean,"is_shown"?: boolean,"name"?: string,"position"?: number,"run_id"?: string,"section_id"?: string,"show_when_field_id"?: string | null,"show_when_value"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_tasks_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "run_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_tasks_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_tasks_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "run_sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_tasks_show_when_field_id_fkey"
      columns: ["show_when_field_id"]
isOneToOne: false
      referencedRelation: "run_fields"
      referencedColumns: ["id"]
    }
                  ]
                },"runs": {
                  Row: {
                    "case_name": string,"created_at": string,"id": string,"run_manager_id": string,"status": string,"template_id": string | null,"template_name": string,"template_version": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "case_name": string,"created_at"?: string,"id"?: string,"run_manager_id": string,"status"?: string,"template_id"?: string | null,"template_name": string,"template_version"?: number | null
                  }
                  Update: {
                    "case_name"?: string,"created_at"?: string,"id"?: string,"run_manager_id"?: string,"status"?: string,"template_id"?: string | null,"template_name"?: string,"template_version"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "runs_run_manager_id_fkey"
      columns: ["run_manager_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "runs_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"template_draft_names": {
                  Row: {
                    "name": string,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"template_id": string
                  }
                  Update: {
                    "name"?: string,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_draft_names_template_id_fkey"
      columns: ["template_id"]
isOneToOne: true
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"template_fields": {
                  Row: {
                    "id": string,"name": string,"options": (string)[],"position": number,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"options": (string)[],"position": number,"template_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"options"?: (string)[],"position"?: number,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_fields_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"template_sections": {
                  Row: {
                    "id": string,"name": string,"position": number,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"position": number,"template_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"position"?: number,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_sections_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"template_tasks": {
                  Row: {
                    "id": string,"is_required": boolean,"name": string,"position": number,"section_id": string,"show_when_field_id": string | null,"show_when_value": string | null,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_required": boolean,"name": string,"position": number,"section_id": string,"show_when_field_id"?: string | null,"show_when_value"?: string | null,"template_id": string
                  }
                  Update: {
                    "id"?: string,"is_required"?: boolean,"name"?: string,"position"?: number,"section_id"?: string,"show_when_field_id"?: string | null,"show_when_value"?: string | null,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_tasks_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "template_sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_tasks_section_template_fkey"
      columns: ["section_id","template_id"]
isOneToOne: false
      referencedRelation: "template_sections"
      referencedColumns: ["id","template_id"]
    },{
      foreignKeyName: "template_tasks_show_when_field_id_fkey"
      columns: ["show_when_field_id"]
isOneToOne: false
      referencedRelation: "template_fields"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_tasks_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"template_versions": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"created_by": string | null,"id": string,"number": number,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"number": number,"template_id": string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"number"?: number,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_versions_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"templates": {
                  Row: {
                    "created_at": string,"current_version": number | null,"has_unpublished_changes": boolean,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_version"?: number | null,"has_unpublished_changes"?: boolean,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"current_version"?: number | null,"has_unpublished_changes"?: boolean,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "run_overview": {
                  Row: {
                    "case_name": string | null,"created_at": string | null,"done_count": number | null,"id": string | null,"run_manager_id": string | null,"status": string | null,"template_name": string | null,"total_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "runs_run_manager_id_fkey"
      columns: ["run_manager_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_template_section":
{ Args: { "p_name": string,"p_template_id": string }; Returns: string
                           },
"add_template_task":
{ Args: { "p_is_required"?: boolean,"p_name": string,"p_section_id": string,"p_template_id": string }; Returns: string
                           },
"launch_run":
{ Args: { "p_assignments"?: Json,"p_case_name": string,"p_expected_version"?: number,"p_template_id": string }; Returns: string
                           },
"mark_task_done":
{ Args: { "p_confirmed"?: boolean,"p_task_id": string }; Returns: undefined
                           },
"move_template_item":
{ Args: { "p_direction": number,"p_id": string,"p_kind": string }; Returns: undefined
                           },
"move_template_task_to_section":
{ Args: { "p_section": string,"p_task": string }; Returns: undefined
                           },
"save_template_version":
{ Args: { "p_template_id": string }; Returns: number
                           },
"set_run_field_answer":
{ Args: { "p_answer": string,"p_field_id": string }; Returns: undefined
                           },
"staff_directory":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"id": string
            }[]
                           },
"take_ai_request":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"templates_with_unpublished_changes":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string
            }[]
                           },
"vendor_run_tasks":
{ Args: { "p_run_id": string }; Returns: {
              "id": string,"is_required": boolean,"name": string,"needs_confirmation": boolean,"section_name": string,"section_position": number,"status": string,"task_position": number
            }[]
                           },
"vendor_runs":
{ Args: Record<PropertyKey, never>; Returns: {
              "case_name": string,"created_at": string,"id": string,"my_done": number,"my_total": number,"status": string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
