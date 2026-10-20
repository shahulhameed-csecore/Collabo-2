export default function DashboardLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-8">
      {/* Top Banner & Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded-lg" />
          <div className="h-4 w-72 bg-muted/60 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-28 bg-muted rounded-xl" />
          <div className="h-9 w-32 bg-emerald-500/20 rounded-xl" />
        </div>
      </div>

      {/* 4 Metric Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-border bg-card/40 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-muted/70 rounded" />
              <div className="w-7 h-7 rounded-lg bg-muted/50" />
            </div>
            <div className="h-7 w-16 bg-muted rounded" />
            <div className="h-3 w-32 bg-muted/40 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content / Table Skeleton */}
      <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="h-9 w-64 bg-muted/60 rounded-xl" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 bg-muted/50 rounded-lg" />
            <div className="h-8 w-20 bg-muted/50 rounded-lg" />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 px-2 border-b border-border/40 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-muted/70" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted/50 rounded" />
                </div>
              </div>
              <div className="h-4 w-20 bg-muted/50 rounded" />
              <div className="h-4 w-24 bg-muted/60 rounded" />
              <div className="h-6 w-16 bg-muted/60 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
