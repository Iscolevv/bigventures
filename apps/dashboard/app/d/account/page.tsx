import { requireDriver } from '@/lib/driver-session';
import { ChangePasswordForm } from '@/components/driver/ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function DriverAccountPage() {
  const me = await requireDriver();
  return (
    <>
      <h1 className="text-lg font-semibold">Account</h1>
      <p className="mt-1 text-sm text-muted">{me.name}</p>
      <ChangePasswordForm />
    </>
  );
}
