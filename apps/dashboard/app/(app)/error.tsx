'use client';

export default function AppError({ error }: { error: Error & { digest?: string } }) {
  const forbidden = error.message?.startsWith('Missing permission');
  return (
    <div className="grid place-items-center py-20 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold">{forbidden ? 'Not allowed' : 'Something went wrong'}</h1>
        <p className="mt-2 text-sm text-muted">
          {forbidden
            ? "Your role doesn't have access to this section."
            : 'Try again, or contact the team if it keeps happening.'}
        </p>
      </div>
    </div>
  );
}
