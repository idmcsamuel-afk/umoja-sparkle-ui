import logoMark from "@/assets/umoja-mark-trimmed.png";

interface LogoProps {
  className?: string;
  showWord?: boolean;
}

export const Logo = ({ className = "", showWord = true }: LogoProps) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <img
      src={logoMark}
      alt="UMOJA logo"
      width={36}
      height={36}
      className="h-9 w-9 object-contain drop-shadow-[0_2px_8px_hsl(var(--accent)/0.35)] sm:h-10 sm:w-10"
      loading="eager"
      decoding="async"
    />
    {showWord && (
      <span className="font-display text-xl sm:text-2xl font-semibold tracking-tight bg-gradient-to-r from-foreground via-foreground to-accent bg-clip-text text-transparent">
        UMOJA
      </span>
    )}
  </div>
);
