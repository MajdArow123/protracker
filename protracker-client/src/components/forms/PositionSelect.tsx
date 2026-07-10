import { useTranslation } from 'react-i18next';
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
  label,
}: Props) {
  const { t } = useTranslation();
  const { data: positions, isLoading } = usePositions(sportId);
  return (
    <Select
      label={label ?? t('common.position', 'Position')}
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      error={error}
      disabled={!sportId || isLoading}
    >
      <option value="">{t('ui.selectPosition', 'Select position...')}</option>
      {positions?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}
