import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { useTimezone } from "@/hooks/useTimezone";

const COMMON: { label: string; value: string }[] = [
  { label: "SAST · Johannesburg", value: "Africa/Johannesburg" },
  { label: "WAT · Lagos", value: "Africa/Lagos" },
  { label: "EAT · Nairobi", value: "Africa/Nairobi" },
  { label: "CAT · Harare", value: "Africa/Harare" },
  { label: "GMT · London", value: "Europe/London" },
  { label: "CET · Berlin", value: "Europe/Berlin" },
  { label: "GST · Dubai", value: "Asia/Dubai" },
  { label: "IST · Mumbai", value: "Asia/Kolkata" },
  { label: "SGT · Singapore", value: "Asia/Singapore" },
  { label: "AEST · Sydney", value: "Australia/Sydney" },
  { label: "EST · New York", value: "America/New_York" },
  { label: "PST · Los Angeles", value: "America/Los_Angeles" },
  { label: "BRT · São Paulo", value: "America/Sao_Paulo" },
];

export function TimezoneSelector({ compact = false }: { compact?: boolean }) {
  const [tz, setTz] = useTimezone();
  const known = COMMON.find((c) => c.value === tz);

  return (
    <div className="inline-flex items-center gap-2">
      {!compact && (
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1">
          <Globe className="h-3 w-3" /> Your timezone
        </span>
      )}
      <Select value={tz} onValueChange={setTz}>
        <SelectTrigger
          className={`h-8 rounded-full border-border bg-background/40 text-xs ${compact ? "px-3" : "px-3 min-w-[180px]"}`}
        >
          <SelectValue placeholder={tz}>
            <span className="inline-flex items-center gap-1.5">
              {compact && <Globe className="h-3 w-3" />}
              <span className="truncate">{known?.label ?? tz}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectGroup>
            <SelectLabel>Common</SelectLabel>
            {COMMON.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectGroup>
          {!known && (
            <SelectGroup>
              <SelectLabel>Detected</SelectLabel>
              <SelectItem value={tz}>{tz}</SelectItem>
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export default TimezoneSelector;
