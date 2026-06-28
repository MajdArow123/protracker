import { clsx } from 'clsx';

interface Props {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ name, size = 'md', className }: Props) {
  return (
    <div
      className={clsx(
        'rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold flex-shrink-0',
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
