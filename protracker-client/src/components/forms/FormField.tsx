import { Input } from '../ui/Input';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export function FormField({ label, error, helperText, ...props }: Props) {
  return (
    <Input label={label} error={error} helperText={helperText} {...props} />
  );
}
