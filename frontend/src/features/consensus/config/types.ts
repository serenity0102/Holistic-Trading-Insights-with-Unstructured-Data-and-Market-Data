export interface ValidationRule {
  required?: boolean;
  pattern?: RegExp;
  message: string;
  future?: boolean;
  maxYears?: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'url' | 'select' | 'date';
  placeholder?: string;
  options?: SelectOption[];
  validation: ValidationRule;
}

export interface RequestType {
  id: string;
  label: string;
  fields: FormField[];
}

export interface RequestFormData {
  requestType: string;
  fields: Record<string, string>;
} 