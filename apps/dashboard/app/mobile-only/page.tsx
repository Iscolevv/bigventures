export default function MobileOnly() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold">Use the Big Ventures driver app</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is a driver account. Trip logging, vehicle checks, fuel entries and proof of
          delivery all happen in the Android app. The web dashboard is for the office team.
        </p>
      </div>
    </main>
  );
}
