interface LogoProps {
  className?: string;
  showWord?: boolean;
}

export const Logo = ({ className = "", showWord = true }: LogoProps) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="relative h-9 w-9 rounded-2xl bg-gradient-primary shadow-glow grid place-items-center">
      <div className="absolute inset-[3px] rounded-[14px] border border-accent/40" />
      <span className="font-display text-[13px] font-bold text-primary-foreground tracking-tight">U</span>
    </div>
    {showWord && (
      <span className="font-display text-xl font-semibold tracking-tight">
        UMOJA
      </span>
    )}
  </div>
);
