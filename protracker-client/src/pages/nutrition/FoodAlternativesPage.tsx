import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { useFoodAlternatives } from '../../hooks/useReports';

function Stars({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span className="text-amber-400 text-sm" aria-label={`${score} out of ${max}`}>
      {'★'.repeat(score)}{'☆'.repeat(max - score)}
    </span>
  );
}

export function FoodAlternativesPage() {
  const { t } = useTranslation();
  const { data: alternatives, isLoading } = useFoodAlternatives();
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!alternatives) return [];
    const q = filter.toLowerCase();
    return alternatives.filter(
      a =>
        a.originalFood.toLowerCase().includes(q) ||
        a.alternativeFood.toLowerCase().includes(q)
    );
  }, [alternatives, filter]);

  // Group by originalFood
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(a => {
      const key = a.originalFood;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (isLoading) return <PageSpinner />;

  return (
    <PageWrapper title={t('nutrition.foodAltLibrary', 'Food Alternatives Library')}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder={t('nutrition.filterByFood', 'Filter by food name…')}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {grouped.length === 0 ? (
        <EmptyState title={t('nutrition.noAltFound', 'No alternatives found')} description={filter ? t('nutrition.noResultsFor', 'No results for "{{filter}}"', { filter }) : t('nutrition.noAltInLibrary', 'No food alternatives in the library')} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([original, items]) => (
            <Card key={original} header={t('nutrition.altHeader', '{{food}} alternatives', { food: original })}>
              <div className="space-y-4">
                {items.map(item => (
                  <div key={item.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                          {item.originalFood} → {item.alternativeFood}
                        </p>
                        {item.reasonExplanation && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.reasonExplanation}</p>
                        )}
                        {item.sportPerformanceNote && (
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 italic">
                            {item.sportPerformanceNote}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">{t('nutrition.protein', 'Protein')} <Stars score={item.proteinMatchScore} /></span>
                      <span className="flex items-center gap-1">{t('nutrition.carbs', 'Carbs')} <Stars score={item.carbMatchScore} /></span>
                      <span className="flex items-center gap-1">{t('nutrition.fat', 'Fat')} <Stars score={item.fatMatchScore} /></span>
                      <span className="flex items-center gap-1">{t('nutrition.calories', 'Calories')} <Stars score={item.calorieMatchScore} /></span>
                      <span className="flex items-center gap-1">{t('nutrition.recovery', 'Recovery')} <Stars score={item.recoveryValue} /></span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
