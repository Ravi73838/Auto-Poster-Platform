export function Spinner({ className }: { className?: string }) {
  return (
    <div className="flex items-center justify-center p-4">
      <div
        className={`animate-spin rounded-full border-2 border-primary border-t-transparent h-6 w-6 ${className ?? ''}`}
      />
    </div>
  );
}

