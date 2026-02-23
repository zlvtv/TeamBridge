import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';

interface FormField {
  value: any;
  error: string | null;
  touched: boolean;
}

interface FormContextType {
  values: Record<string, any>;
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
  setFieldValue: (name: string, value: any) => void;
  setFieldTouched: (name: string, touched: boolean) => void;
  validateField: (name: string) => void;
  registerField: (name: string, validators: Validator[]) => void;
  unregisterField: (name: string) => void;
}

type Validator = (value: any) => string | null;

const FormContext = createContext<FormContextType | undefined>(undefined);

interface FormProviderProps {
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  children: React.ReactNode;
}

export const FormProvider: React.FC<FormProviderProps> = ({ 
  initialValues = {}, 
  onSubmit, 
  children 
}) => {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [validators, setValidators] = useState<Record<string, Validator[]>>({});

  const registerField = useCallback((name: string, fieldValidators: Validator[]) => {
    setValidators(prev => ({
      ...prev,
      [name]: fieldValidators
    }));
  }, []);

  const unregisterField = useCallback((name: string) => {
    setValidators(prev => {
      const newValidators = { ...prev };
      delete newValidators[name];
      return newValidators;
    });
  }, []);

  const setFieldValue = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    if (touched[name]) {
      validateField(name);
    }
  }, [touched]);

  const setFieldTouched = useCallback((name: string, isTouched: boolean) => {
    setTouched(prev => ({ ...prev, [name]: isTouched }));
    
    if (isTouched) {
      validateField(name);
    }
  }, []);

  const validateField = useCallback((name: string) => {
    const fieldValidators = validators[name] || [];
    const value = values[name];
    
    for (const validator of fieldValidators) {
      const error = validator(value);
      if (error) {
        setErrors(prev => ({ ...prev, [name]: error }));
        return error;
      }
    }
    
    setErrors(prev => ({ ...prev, [name]: null }));
    return null;
  }, [validators, values]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    Object.keys(validators).forEach(name => setFieldTouched(name, true));
 
    const hasErrors = Object.keys(validators).some(name => validateField(name));
    
    if (!hasErrors) {
      onSubmit(values);
    }
  };

  const contextValue = useMemo(() => ({
    values,
    errors,
    touched,
    setFieldValue,
    setFieldTouched,
    validateField,
    registerField,
    unregisterField
  }), [values, errors, touched, registerField, unregisterField]);

  return (
    <FormContext.Provider value={contextValue}>
      <form onSubmit={handleSubmit}>
        {children}
      </form>
    </FormContext.Provider>
  );
};

export const useForm = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useForm must be used within a FormProvider');
  }
  return context;
};
