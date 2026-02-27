'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useToast } from '@/components/ToastProvider';

/**
 * Wrapper do supabase com error handling automático via toast.
 * Usa o mesmo client singleton — sem instâncias extras.
 */
export function useDb() {
  const supabase = createClient();
  const toast = useToast();

  /**
   * Executa uma query Supabase e exibe toast de erro automaticamente.
   * Retorna { data, error } — mesma assinatura do Supabase.
   * @param queryFn  Função que retorna a query (sem await)
   * @param errorMsg Mensagem customizada de erro (opcional)
   */
  const run = useCallback(async <T>(
    queryFn: () => PromiseLike<{ data: T | null; error: any }>,
    errorMsg?: string
  ): Promise<{ data: T | null; error: any }> => {
    try {
      const result = await queryFn();
      if (result.error) {
        const msg = errorMsg || result.error.message || 'Database error';
        toast.error(msg);
      }
      return result;
    } catch (e: any) {
      const msg = errorMsg || e?.message || 'Unexpected error';
      toast.error(msg);
      return { data: null, error: e };
    }
  }, [toast]);

  return { db: supabase, run };
}

/**
 * Hook de validação simples para formulários.
 */
export type ValidationRules<T> = Partial<{
  [K in keyof T]: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: T[K]) => string | null;
    label?: string;
  };
}>;

export function validate<T extends Record<string, any>>(
  data: T,
  rules: ValidationRules<T>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const key in rules) {
    const rule = rules[key];
    if (!rule) continue;
    const value = data[key];
    const label = rule.label || key;

    if (rule.required && (value === null || value === undefined || value === '')) {
      errors[key] = `${label} is required`;
      continue;
    }

    if (value === null || value === undefined || value === '') continue;

    if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      errors[key] = `${label} must be at least ${rule.minLength} characters`;
    }
    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      errors[key] = `${label} must be at most ${rule.maxLength} characters`;
    }
    if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
      errors[key] = `${label} must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
      errors[key] = `${label} must be at most ${rule.max}`;
    }
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      errors[key] = `${label} is invalid`;
    }
    if (rule.custom) {
      const msg = rule.custom(value);
      if (msg) errors[key] = msg;
    }
  }

  return errors;
}
