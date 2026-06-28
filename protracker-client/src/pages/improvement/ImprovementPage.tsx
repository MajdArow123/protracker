import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export function ImprovementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <PageWrapper
      title="Improvement Plan"
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/players/${id}`)}
        >
          <ArrowLeft size={16} /> Back
        </Button>
      }
    >
      <div className="max-w-lg text-gray-500 dark:text-gray-400">
        Improvement plan page coming in Phase 5.
      </div>
    </PageWrapper>
  );
}
