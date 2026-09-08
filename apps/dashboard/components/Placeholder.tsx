import { PageHeader, EmptyState } from './ui';

export function Placeholder({ title, phase, what }: { title: string; phase: string; what: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={phase} />
      <EmptyState title={what} hint="This view is scaffolded; wiring lands in the phase noted above." />
    </>
  );
}
