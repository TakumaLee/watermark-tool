export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="animate-spin w-10 h-10 border-3 border-accent border-t-transparent rounded-full mb-4" />
      <p className="text-text-secondary text-sm">正在讀取影片資訊...</p>
    </div>
  );
}
