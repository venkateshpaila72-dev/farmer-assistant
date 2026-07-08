export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="text-center py-12">
      <p className="text-danger font-medium mb-3">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-semibold text-primary underline">
          Try again
        </button>
      )}
    </div>
  );
}