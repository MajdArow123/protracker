import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export function TeamFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  return (
    <PageWrapper
      title={isEdit ? 'Edit Team' : 'New Team'}
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/teams')}
        >
          <ArrowLeft size={16} /> Back
        </Button>
      }
    >
      <div className="max-w-lg text-gray-500 dark:text-gray-400">
        Team form coming in Phase 5.
      </div>
    </PageWrapper>
  );
}
