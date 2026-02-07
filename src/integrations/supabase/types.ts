export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Custom Status Interfaces
export interface SerialStatus {
  id: string;
  status_code: string;
  display_name_th: string;
  display_name_en: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface StickerStatus {
  id: string;
  status_code: string;
  display_name_th: string;
  display_name_en: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// Union Types สำหรับ Type Safety
export type SerialStatusCode = 
  | 'ready' 
  | 'in_use' 
  | 'unavailable' 
  | 'in_repair' 
  | 'retired' 
  | 'lost' 
  | 'disposed' 
  | 'inactive';

export type StickerStatusCode = 'pending' | 'completed';

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string
          operation: string
          old_data: Json | null
          new_data: Json | null
          changed_by_email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          operation: string
          old_data?: Json | null
          new_data?: Json | null
          changed_by_email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string
          operation?: string
          old_data?: Json | null
          new_data?: Json | null
          changed_by_email?: string | null
          created_at?: string
        }
        Relationships: []
      }

      categories: {
        Row: {
          id: string
          name: string
          code: string | null
          parent_id: string | null
          type: string | null
          sort_order: number | null
          note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          code?: string | null
          parent_id?: string | null
          type?: string | null
          sort_order?: number | null
          note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          code?: string | null
          parent_id?: string | null
          type?: string | null
          sort_order?: number | null
          note?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          note: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          note?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          note?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          emp_code: string | null
          name: string
          nickname: string | null
          gender: string | null
          email: string | null
          tel: string | null
          image_url: string | null
          location: string | null
          location_id: string | null
          department_id: string | null
          user_id: string | null
          status: string
          created_at: string | null
          updated_at: string | null 
        }
        Insert: {
          id?: string
          emp_code?: string | null
          name: string
          nickname?: string | null
          gender?: string | null
          email?: string | null
          tel?: string | null
          image_url?: string | null
          location?: string | null
          location_id?: string | null
          department_id?: string | null
          user_id?: string | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          emp_code?: string | null
          name?: string
          nickname?: string | null
          gender?: string | null
          email?: string | null
          tel?: string | null
          image_url?: string | null
          location?: string | null
          location_id?: string | null
          department_id?: string | null
          user_id?: string | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }

      locations: {
        Row: {
          address: string | null
          note: string | null
          building: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          note?: string | null
          building?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          note?: string | null
          building?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      serial_statuses: {
        Row: {
          id: string
          status_code: string
          display_name_th: string
          display_name_en: string
          display_order: number
          is_active: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          status_code: string
          display_name_th: string
          display_name_en: string
          display_order?: number
          is_active?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          status_code?: string
          display_name_th?: string
          display_name_en?: string
          display_order?: number
          is_active?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      sticker_statuses: {
        Row: {
          id: string
          status_code: string
          display_name_th: string
          display_name_en: string
          display_order: number
          is_active: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          status_code: string
          display_name_th: string
          display_name_en: string
          display_order?: number
          is_active?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          status_code?: string
          display_name_th?: string
          display_name_en?: string
          display_order?: number
          is_active?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      product_serials: {
        Row: {
          created_at: string | null
          id: string
          location_id: string | null
          product_id: string
          serial_code: string
          status: string | null
          sticker_date: string | null
          sticker_image_url: string | null
          sticker_status: string | null
          image_url: string | null
          notes: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          product_id: string
          serial_code: string
          status?: string | null
          sticker_date?: string | null
          sticker_image_url?: string | null
          sticker_status?: string | null
          image_url?: string | null
          notes?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          product_id?: string
          serial_code?: string
          status?: string | null
          sticker_date?: string | null
          sticker_image_url?: string | null
          sticker_status?: string | null
          image_url?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_serials_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          p_id: string
          price: number | null
          unit: string | null
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          p_id: string
          price?: number | null
          unit?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          p_id?: string
          price?: number | null
          unit?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          borrow_date: string | null
          created_at: string | null
          employee_id: string | null
          department_id: string | null
          id: string
          note: string | null
          return_date: string | null
          serial_id: string
          status: 'Pending' | 'Active' | 'Completed' | 'Rejected' | 'PendingReturn' | null 
        }
        Insert: {
          borrow_date?: string | null
          created_at?: string | null
          employee_id?: string | null
          department_id?: string | null
          id?: string
          note?: string | null
          return_date?: string | null
          serial_id: string
          status?: 'Pending' | 'Active' | 'Completed' | 'Rejected' | 'PendingReturn' | null
        }
        Update: {
          borrow_date?: string | null
          created_at?: string | null
          employee_id?: string
          department_id?: string | null
          id?: string
          note?: string | null
          return_date?: string | null
          serial_id?: string
          status?: 'Pending' | 'Active' | 'Completed' | 'Rejected' | 'PendingReturn' | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_serial_id_fkey"
            columns: ["serial_id"]
            isOneToOne: false
            referencedRelation: "product_serials"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_groups: {
        Row: {
          id: string
          label: string
          icon: string | null
          order_index: number
          is_active: boolean
          is_core: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          label: string
          icon?: string | null
          order_index?: number
          is_active?: boolean
          is_core?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          label?: string
          icon?: string | null
          order_index?: number
          is_active?: boolean
          is_core?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      navigation_items: {
        Row: {
          id: string
          group_id: string | null
          label: string
          path: string
          icon: string | null
          order_index: number
          is_visible: boolean
          roles: string[]
          is_core: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          group_id?: string | null
          label: string
          path: string
          icon?: string | null
          order_index?: number
          is_visible?: boolean
          roles?: string[]
          is_core?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string | null
          label?: string
          path?: string
          icon?: string | null
          order_index?: number
          is_visible?: boolean
          roles?: string[]
          is_core?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "navigation_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "navigation_groups"
            referencedColumns: ["id"]
          }
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      
    }
    Views: {
      view_products_with_stock: {
        Row: {
          id: string
          p_id: string
          name: string
          model: string | null
          category: string
          brand: string | null
          description: string | null
          notes: string | null
          price: number
          unit: string
          image_url: string | null
          created_at: string
          updated_at: string | null
          stock_total: number
          stock_available: number
        }
        Insert: never // Views ไม่สามารถ Insert ได้
        Update: never // Views ไม่สามารถ Update ได้
        Relationships: []
      }
      view_users_full: {
        Row: {
          id: string
          user_id: string | null
          emp_code: string | null
          name: string
          nickname: string | null
          gender: string | null
          email: string | null
          tel: string | null
          department_id: string | null
          department_name: string | null
          location_id: string | null
          location_name: string | null
          status: string
          role: string | null
          employee_role: string | null
          account_role: string | null
          image_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Functions: {
      user_borrow_item: {
        Args: {
          p_employee_id: string
          p_serial_id: string
          p_note: string
        }
        Returns: Json
      }
      request_borrow_item: {
        Args: {
          p_employee_id: string
          p_product_id: string
          p_note: string
        }
        Returns: Json
      }
      update_product_and_stock: {
        Args: {
          arg_product_id: string
          arg_sku: string
          arg_name: string
          arg_category: string
          arg_brand?: string | null
          arg_model?: string | null
          arg_description?: string | null
          arg_notes?: string | null
          arg_price: number
          arg_unit: string
          arg_image_url?: string | null
          arg_new_total_quantity: number
        }
        Returns: Json
      }
      
      create_product_and_serials: {
        Args: {
          arg_p_id: string
          arg_name: string
          arg_category: string
          arg_brand?: string | null
          arg_model?: string | null
          arg_description?: string | null
          arg_notes?: string | null
          arg_price: number
          arg_unit: string
          arg_image_url?: string | null
          arg_initial_quantity: number
        }
        Returns: Json
      }
      
      import_products_bulk: {
        Args: {
          products_data: Json
        }
        Returns: Json
      },

      delete_product_safe: {
        Args: {
          arg_product_id: string
        }
        Returns: Json
      },

      update_serial_status: {
        Args: {
          arg_serial_id: string
          arg_status: string
          arg_sticker_status: string
          arg_sticker_date?: string | null
          arg_sticker_image_url?: string | null
          arg_image_url?: string | null
          arg_notes?: string | null
          arg_location_id?: string | null
        }
        Returns: Json
      },

      delete_serial_safe: {
        Args: {
          arg_serial_id: string
        }
        Returns: Json
      },
      
      delete_employee_safe: {
        Args: {
          arg_employee_id: string
        }
        Returns: Json
      },

      import_employees_bulk: {
        Args: {
          employees_data: Json
        }
        Returns: Json
      },
      borrow_item: {
        Args: {
          arg_serial_id: string
          arg_borrower_id: string
          arg_borrower_type: string
          arg_note: string
        }
        Returns: Json
      },
      return_item: {
        Args: {
          arg_transaction_id: string
          arg_return_condition: string
          arg_note: string
        }
        Returns: Json
      },
      
      // ฟังก์ชันการลบข้อมูลของหน้า Settings
      delete_department_safe: {
        Args: {
          arg_department_id: string
        }
        Returns: Json
      },
      delete_location_safe: {
        Args: {
          arg_location_id: string
        }
        Returns: Json
      },
      delete_category_safe: {
        Args: {
          arg_category_id: string
        }
        Returns: Json
      },
      
      // ฟังก์ชันดึงข้อมูลหน้า Dashboard
      get_dashboard_summary: {
        Args: Record<string, never>
        Returns: {
          totalValue: number
          totalItems: number
          availableCount: number
          borrowedCount: number
          repairCount: number
          categoryStats: { name: string; value: number }[]
          statusStats: { name: string; count: number }[]
          lowStockItems: {
            id: string
            name: string
            p_id: string
            brand: string | null
            model: string | null
            category: string
            current: number
            total: number
            image: string | null
          }[]
        }
      },
      get_dashboard_inventory: {
        Args: Record<string, never>
        Returns: {
          id: string
          p_id: string
          name: string
          image_url: string | null
          category: string
          brand: string | null
          model: string | null
          total: number
          available: number
          borrowed: number
          issue: number
          inactive: number
        }[]
      },

      user_claim_asset: {
        Args: {
          arg_serial_code: string
          arg_borrower_id: string
          arg_note?: string
        }
        Returns: Json
      },

      // Functions ใหม่สำหรับอนุมัติ/ปฏิเสธ
      approve_borrow_request: {
        Args: {
          arg_transaction_id: string
        }
        Returns: Json
      },
      
      reject_borrow_request: {
        Args: {
          arg_transaction_id: string
          arg_reason: string
        }
        Returns: Json
      },

      request_return_item: {
        Args: {
          arg_transaction_id: string
          arg_return_note: string
        }
        Returns: Json
      },

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
