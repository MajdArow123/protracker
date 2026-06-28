import { Select } from '../ui/Select';
import { useSports } from '../../hooks/useSports';

interface Props {
  value?: number | string;
  onChange: (sportId: number) => void;
  error?: string;
  label?: string;
}

export function SportSelect({
  value,
  onChange,
  error,
  label = 'Sport',
}: Props) {
  const { data: sports, isLoading } = useSports();
  return (
    <Select
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      error={error}
      disabled={isLoading}
    >
      <option value="">Select sport...</option>
      {sports?.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
