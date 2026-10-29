export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      catalogue_meta: {
        Row: {
          categories_in_catalogue: number
          finishes_in_catalogue: number
          id: boolean
          products_in_catalogue: number
          updated_at: string
        }
        Insert: {
          categories_in_catalogue?: number
          finishes_in_catalogue?: number
          id?: boolean
          products_in_catalogue?: number
          updated_at?: string
        }
        Update: {
          categories_in_catalogue?: number
          finishes_in_catalogue?: number
          id?: boolean
          products_in_catalogue?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          blurb: string[]
          created_at: string
          icon: string | null
          id: string
          image: string | null
          name: string
          position: number
          published_version: number | null
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          blurb?: string[]
          created_at?: string
          icon?: string | null
          id?: string
          image?: string | null
          name: string
          position?: number
          published_version?: number | null
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          blurb?: string[]
          created_at?: string
          icon?: string | null
          id?: string
          image?: string | null
          name?: string
          position?: number
          published_version?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      finishes: {
        Row: {
          code: string
          created_at: string
          family: string
          id: string
          name: string
          published_version: number | null
          slug: string
          status: Database["public"]["Enums"]["finish_status"]
          swatch_path: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          family: string
          id?: string
          name: string
          published_version?: number | null
          slug: string
          status?: Database["public"]["Enums"]["finish_status"]
          swatch_path?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          family?: string
          id?: string
          name?: string
          published_version?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["finish_status"]
          swatch_path?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      grid_views: {
        Row: {
          column_state: Json
          created_at: string
          filter_model: Json
          id: string
          name: string
          owner: string
          shared: boolean
          sort_model: Json
        }
        Insert: {
          column_state?: Json
          created_at?: string
          filter_model?: Json
          id?: string
          name: string
          owner?: string
          shared?: boolean
          sort_model?: Json
        }
        Update: {
          column_state?: Json
          created_at?: string
          filter_model?: Json
          id?: string
          name?: string
          owner?: string
          shared?: boolean
          sort_model?: Json
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          applied_at: string | null
          counts: Json
          created_at: string
          created_by: string
          entity: string
          error: string | null
          file_name: string
          file_path: string
          id: string
          mapping: Json
          options: Json
          status: string
        }
        Insert: {
          applied_at?: string | null
          counts?: Json
          created_at?: string
          created_by?: string
          entity: string
          error?: string | null
          file_name: string
          file_path: string
          id?: string
          mapping?: Json
          options?: Json
          status?: string
        }
        Update: {
          applied_at?: string | null
          counts?: Json
          created_at?: string
          created_by?: string
          entity?: string
          error?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mapping?: Json
          options?: Json
          status?: string
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          applied: boolean
          base_version: number | null
          diff: Json | null
          errors: string[]
          job_id: string
          key: string | null
          outcome: string | null
          parsed: Json | null
          raw: Json
          row_number: number
          target_id: string | null
        }
        Insert: {
          applied?: boolean
          base_version?: number | null
          diff?: Json | null
          errors?: string[]
          job_id: string
          key?: string | null
          outcome?: string | null
          parsed?: Json | null
          raw: Json
          row_number: number
          target_id?: string | null
        }
        Update: {
          applied?: boolean
          base_version?: number | null
          diff?: Json | null
          errors?: string[]
          job_id?: string
          key?: string | null
          outcome?: string | null
          parsed?: Json | null
          raw?: Json
          row_number?: number
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_presets: {
        Row: {
          created_at: string
          created_by: string
          entity: string
          id: string
          mapping: Json
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          entity: string
          id?: string
          mapping: Json
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entity?: string
          id?: string
          mapping?: Json
          name?: string
        }
        Relationships: []
      }
      product_finishes: {
        Row: {
          code_override: string | null
          finish_id: string
          image_path: string | null
          position: number
          product_id: string
        }
        Insert: {
          code_override?: string | null
          finish_id: string
          image_path?: string | null
          position?: number
          product_id: string
        }
        Update: {
          code_override?: string | null
          finish_id?: string
          image_path?: string | null
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_finishes_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "finish_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_finishes_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "finishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_finishes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_finishes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string
          caption: string | null
          created_at: string
          height: number | null
          id: string
          path: string
          position: number
          product_id: string
          width: number | null
        }
        Insert: {
          alt?: string
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          path: string
          position?: number
          product_id: string
          width?: number | null
        }
        Update: {
          alt?: string
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          path?: string
          position?: number
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          category_id: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          category_id: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          category_id?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string
          datasheet_path: string | null
          description: string
          dimensions: string | null
          featured: boolean
          featured_rank: number | null
          features: string[]
          id: string
          import_job_id: string | null
          name: string
          position: number
          published_version: number | null
          sku: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          type_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          category_id: string
          created_at?: string
          datasheet_path?: string | null
          description?: string
          dimensions?: string | null
          featured?: boolean
          featured_rank?: number | null
          features?: string[]
          id?: string
          import_job_id?: string | null
          name: string
          position?: number
          published_version?: number | null
          sku: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          datasheet_path?: string | null
          description?: string
          dimensions?: string | null
          featured?: boolean
          featured_rank?: number | null
          features?: string[]
          id?: string
          import_job_id?: string | null
          name?: string
          position?: number
          published_version?: number | null
          sku?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_counts"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "products_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "type_counts"
            referencedColumns: ["type_id"]
          },
        ]
      }
      published_categories: {
        Row: {
          category_id: string
          position: number
          published_at: string
          slug: string
          snapshot: Json
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          category_id: string
          position?: number
          published_at?: string
          slug: string
          snapshot: Json
          status: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          category_id?: string
          position?: number
          published_at?: string
          slug?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "published_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "category_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      published_finishes: {
        Row: {
          finish_id: string
          published_at: string
          slug: string
          snapshot: Json
          status: Database["public"]["Enums"]["finish_status"]
        }
        Insert: {
          finish_id: string
          published_at?: string
          slug: string
          snapshot: Json
          status: Database["public"]["Enums"]["finish_status"]
        }
        Update: {
          finish_id?: string
          published_at?: string
          slug?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["finish_status"]
        }
        Relationships: [
          {
            foreignKeyName: "published_finishes_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: true
            referencedRelation: "finish_usage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_finishes_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: true
            referencedRelation: "finishes"
            referencedColumns: ["id"]
          },
        ]
      }
      published_products: {
        Row: {
          category_slug: string
          featured: boolean
          featured_rank: number | null
          finish_count: number
          finishes: string[]
          materials: string[]
          name: string
          position: number
          product_id: string
          published_at: string
          sku: string
          slug: string
          snapshot: Json
          status: Database["public"]["Enums"]["entity_status"]
          type_slug: string | null
        }
        Insert: {
          category_slug: string
          featured?: boolean
          featured_rank?: number | null
          finish_count?: number
          finishes?: string[]
          materials?: string[]
          name: string
          position?: number
          product_id: string
          published_at?: string
          sku: string
          slug: string
          snapshot: Json
          status: Database["public"]["Enums"]["entity_status"]
          type_slug?: string | null
        }
        Update: {
          category_slug?: string
          featured?: boolean
          featured_rank?: number | null
          finish_count?: number
          finishes?: string[]
          materials?: string[]
          name?: string
          position?: number
          product_id?: string
          published_at?: string
          sku?: string
          slug?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["entity_status"]
          type_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "published_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      redirects: {
        Row: {
          created_at: string
          from_slug: string
          product_id: string
        }
        Insert: {
          created_at?: string
          from_slug: string
          product_id: string
        }
        Update: {
          created_at?: string
          from_slug?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_addresses: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      revisions: {
        Row: {
          entity_id: string
          entity_type: string
          id: number
          note: string | null
          published_at: string
          published_by: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: never
          note?: string | null
          published_at?: string
          published_by?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: never
          note?: string | null
          published_at?: string
          published_by?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: []
      }
      sign_in_log: {
        Row: {
          at: string
          email: string
          id: number
          ip: string | null
          method: string
          user_agent: string | null
        }
        Insert: {
          at?: string
          email: string
          id?: never
          ip?: string | null
          method: string
          user_agent?: string | null
        }
        Update: {
          at?: string
          email?: string
          id?: never
          ip?: string | null
          method?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          email: string
          invited_by: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          invited_by?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          invited_by?: string | null
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_products: {
        Row: {
          category_id: string | null
          category_name: string | null
          category_position: number | null
          category_slug: string | null
          completeness: number | null
          dimensions: string | null
          featured: boolean | null
          finish_count: number | null
          has_changes: boolean | null
          has_datasheet: boolean | null
          id: string | null
          image_path: string | null
          import_job_id: string | null
          missing: string[] | null
          name: string | null
          position: number | null
          published_version: number | null
          sku: string | null
          slug: string | null
          status: Database["public"]["Enums"]["entity_status"] | null
          type_id: string | null
          type_name: string | null
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_counts"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "products_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "type_counts"
            referencedColumns: ["type_id"]
          },
        ]
      }
      category_counts: {
        Row: {
          category_id: string | null
          live: number | null
          products: number | null
        }
        Relationships: []
      }
      duplicate_finish_codes: {
        Row: {
          code: string | null
          finishes: number | null
          slugs: string[] | null
        }
        Relationships: []
      }
      finish_usage: {
        Row: {
          id: string | null
          live_products: number | null
          products: number | null
        }
        Relationships: []
      }
      type_counts: {
        Row: {
          category_id: string | null
          products: number | null
          type_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
    }
    Functions: {
      apply_import: { Args: { p_job: string; p_limit?: number }; Returns: Json }
      can_publish: { Args: never; Returns: boolean }
      delete_draft_product: { Args: { p_id: string }; Returns: undefined }
      delete_unused_finish: { Args: { p_id: string }; Returns: undefined }
      discard_import: { Args: { p_job: string }; Returns: Json }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      is_owner: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      media_in_use: {
        Args: never
        Returns: {
          bucket_id: string
          name: string
        }[]
      }
      product_snapshot: { Args: { p_id: string }; Returns: Json }
      publish_category: {
        Args: { p_id: string; p_note?: string }
        Returns: number
      }
      publish_finish: {
        Args: { p_id: string; p_note?: string }
        Returns: number
      }
      publish_product: {
        Args: { p_id: string; p_note?: string }
        Returns: number
      }
      restore_product: {
        Args: { p_id: string; p_revision: number; p_version: number }
        Returns: number
      }
      save_category: {
        Args: {
          p_fields: Json
          p_id: string
          p_types?: Json
          p_version: number
        }
        Returns: number
      }
      save_product: {
        Args: {
          p_fields: Json
          p_finishes?: string[]
          p_id: string
          p_images?: Json
          p_version: number
        }
        Returns: number
      }
      search_catalogue: {
        Args: { p_limit?: number; p_query: string }
        Returns: Json
      }
      set_category_order: { Args: { p_ids: string[] }; Returns: number }
      set_featured_order: { Args: { p_ids: string[] }; Returns: number }
      set_product_order: {
        Args: { p_category: string; p_ids: string[] }
        Returns: number
      }
      shelf: {
        Args: {
          p_category: string
          p_colours?: string[]
          p_limit?: number
          p_materials?: string[]
          p_offset?: number
          p_sort?: string
          p_types?: string[]
        }
        Returns: Json
      }
      storage_usage: {
        Args: never
        Returns: {
          bucket_id: string
          bytes: number
          files: number
        }[]
      }
      unused_media: {
        Args: { p_grace?: string }
        Returns: {
          bucket_id: string
          bytes: number
          created_at: string
          name: string
        }[]
      }
    }
    Enums: {
      entity_status: "draft" | "active" | "discontinued"
      finish_status: "active" | "retired"
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
      entity_status: ["draft", "active", "discontinued"],
      finish_status: ["active", "retired"],
    },
  },
} as const

