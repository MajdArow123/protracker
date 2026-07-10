import { useTranslation } from 'react-i18next';
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
  label,
}: Props) {
  const { t } = useTranslation();
  const { data: sports, isLoading } = useSports();
  return (
    <Select
      label={label ?? t('common.sport', 'Sport')}
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      error={error}
      disabled={isLoading}
    >
      <option value="">{t('ui.selectSport', 'Select sport...')}</option>
      {sports?.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
