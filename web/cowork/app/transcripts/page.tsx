import { listDigests, listJobs } from '@/lib/db/transcripts';
import TranscriptsView from '@/components/transcripts/TranscriptsView';

export const dynamic = 'force-dynamic';

export default function TranscriptsPage() {
  const digests = listDigests({ limit: 50 });
  const activeJobs = listJobs({
    status: ['queued', 'processing', 'failed'],
    limit: 50,
  });
  const recentDoneJobs = listJobs({ status: ['done', 'skipped'], limit: 20 });
  return (
    <TranscriptsView
      initialDigests={digests}
      initialActiveJobs={activeJobs}
      initialRecentJobs={recentDoneJobs}
    />
  );
}
