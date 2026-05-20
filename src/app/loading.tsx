export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg-base)]">
      {/* Logo */}
      <div className="mb-6 animate-fade-in">
        <svg width="56" height="56" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" stroke="var(--accent)" strokeWidth="3" fill="var(--accent)" fillOpacity="0.06" />
          <path d="M25 68 Q35 40 50 52 Q65 64 75 36" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <circle cx="50" cy="52" r="3.5" fill="var(--accent)" />
          <circle cx="75" cy="36" r="3.5" fill="var(--accent)" />
        </svg>
      </div>
      {/* Title */}
      <div className="text-[20px] font-semibold text-[var(--txt-0)] tracking-wide mb-1 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        鲁班
      </div>
      <div className="text-[11px] text-[var(--txt-2)] tracking-[0.15em] uppercase animate-fade-in" style={{ animationDelay: '0.2s' }}>
        ADS Project Management
      </div>
      {/* Loading indicator */}
      <div className="mt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="w-[120px] h-[2px] bg-[var(--bg-4)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--accent)] rounded-full animate-loading-bar" />
        </div>
      </div>
    </div>
  );
}
