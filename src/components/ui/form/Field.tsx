import React, { useEffect, useRef } from 'react';
import { useForm } from './FormProvider';
import Input from '../input/input';
import Select, { SelectOption } from '../select/select';

interface FieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'textarea' | 'select';
  placeholder?: string;
  options?: SelectOption[];
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  validators?: ((value: any) => string | null)[];
  className?: string;
  hasSearch?: boolean; 
}

const Field: React.FC<FieldProps> = ({
  name,
  label,
  type = 'text',
  placeholder,
  options,
  required = false,
  multiline = false,
  rows = 3,
  disabled = false,
  validators = [],
  className,
  hasSearch = true 
}) => {
  const { 
    values, 
    errors, 
    touched, 
    setFieldValue, 
    setFieldTouched,
    registerField,
    unregisterField
  } = useForm();

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    const fieldValidators = [...validators];
    if (required) {
      fieldValidators.unshift((value) => !value ? `${label} обязательно` : null);
    }
    
    registerField(name, fieldValidators);
    
    return () => {
      unregisterField(name);
    };
  }, [name, label, required, validators, registerField, unregisterField]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFieldValue(name, e.target.value);
  };

  const handleSelectChange = (value: string | string[]) => {
    setFieldValue(name, value);
  };

  const handleBlur = () => {
    setFieldTouched(name, true);
  };

  const renderInput = () => {
    if (type === 'select' && options) {
      return (
        <Select
          value={values[name] || ''}
          onChange={handleSelectChange}
          options={options}
          placeholder={placeholder}
          hasSearch={hasSearch} 
          disabled={disabled}
        />
      );
    }

    return (
      <Input
        ref={inputRef}
        type={type}
        value={values[name] || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        textarea={multiline}
        rows={rows}
        disabled={disabled}
        error={touched[name] && errors[name] ? errors[name] : undefined}
      />
    );
  };

  return (
    <div className={`field ${className || ''}`}>
      <label htmlFor={name} style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
        {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
      </label>
      {renderInput()}
      {touched[name] && errors[name] && (
        <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>
          {errors[name]}
        </div>
      )}
    </div>
  );
};

export default Field;
