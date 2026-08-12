import { Badge } from "@/components/ui/badge";

export type CapabilityTag = { slug: string; label: string; tag_group: string; sort_order: number };

const GROUP_LABELS: Record<string, string> = {
  sector: "Sector / capability",
  consortium: "Consortium contribution",
};

export default function TagPicker({
  tags,
  selected,
  onToggle,
}: {
  tags: CapabilityTag[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  if (tags.length === 0) return null;
  const groups = Array.from(new Set(tags.map((t) => t.tag_group)));

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g} className="space-y-1">
          <p className="text-[11px] text-muted-foreground">{GROUP_LABELS[g] ?? g}</p>
          <div className="flex flex-wrap gap-1.5">
            {tags
              .filter((t) => t.tag_group === g)
              .map((t) => {
                const active = selected.includes(t.slug);
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => onToggle(t.slug)}
                    aria-pressed={active}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer text-[10px] font-normal"
                    >
                      {t.label}
                    </Badge>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
