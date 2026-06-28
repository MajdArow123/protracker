import { Select } from '../ui/Select';
import { usePositions } from '../../hooks/useSports';

interface Props {
  sportId?: number;
  value?: number | string;
  onChange: (positionId: number) => void;
  error?: string;
  label?: string;
}

export function PositionSelect({
  sportId,
  value,
  onChange,
  error,
  label = 'Position',
}: Props) {
  const { data: positions, isLoading } = usePositions(sportId);
  return (
    <Select
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      error={error}
      disabled={!sportId || isLoading}
    >
      <option value="">Select position...</option>
      {positions?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}
