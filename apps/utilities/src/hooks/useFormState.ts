'use client';

import {useCallback, useState} from 'react';

export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  isSubmitting: boolean;
  setValue: (field: keyof T, value: string) => void;
  setError: (field: keyof T, message: string) => void;
  clearError: (field: keyof T) => void;
  setSubmitting: (v: boolean) => void;
  reset: () => void;
}

export function useFormState<T extends Record<string, string>>(initial: T): FormState<T> {
  const [values, setValues]           = useState<T>(initial);
  const [errors, setErrors]           = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setSubmitting] = useState(false);

  const setValue = useCallback((field: keyof T, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const setError = useCallback((field: keyof T, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const reset = useCallback(() => {
    setValues(initial);
    setErrors({});
    setSubmitting(false);
  }, [initial]);

  return { values, errors, isSubmitting, setValue, setError, clearError, setSubmitting, reset };
}
