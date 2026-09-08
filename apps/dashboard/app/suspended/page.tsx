export default function Suspended() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold">Account not active</h1>
        <p className="mt-2 text-sm text-muted">
          This account has been suspended or archived. Contact operations if you think this is a
          mistake.
        </p>
      </div>
    </main>
  );
}
