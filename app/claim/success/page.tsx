export default function ClaimSuccessPage({
  searchParams,
}: {
  searchParams: { edit_token?: string };
}) {
  return (
    <main className="max-w-md mx-auto text-center py-12">
      <h1 className="text-xl font-medium mb-3">Payment confirmed</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Your listing goes live within a few seconds. Save this edit code somewhere safe - it's the
        only way to withdraw your listing later, and we cannot recover it for you if lost.
      </p>
      {searchParams.edit_token ? (
        <code className="block bg-neutral-100 rounded-lg p-3 text-xs break-all mb-6">
          {searchParams.edit_token}
        </code>
      ) : (
        <p className="text-sm text-red-600 mb-6">
          No edit code was found in the URL - check your confirmation email instead.
        </p>
      )}
      <a href="/" className="text-sm underline">
        Back to the leaderboard
      </a>
    </main>
  );
}
