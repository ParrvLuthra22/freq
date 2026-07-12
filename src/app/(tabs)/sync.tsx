import { SyncMoment } from '@/components/sync-moment';
import { getDemoMatch } from '@/lib/seed';

export default function SyncScreen() {
  const match = getDemoMatch();
  return <SyncMoment user={match} />;
}
