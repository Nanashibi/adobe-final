import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExtractedSection } from "@/types/api";

interface SectionsListProps {
  sections: ExtractedSection[];
  onSelect: (doc: string, page: number, title: string) => void;
}

const SectionsList = ({ sections, onSelect }: SectionsListProps) => {
  const sorted = [...sections].sort((a, b) => a.importance_rank - b.importance_rank);
  return (
    <ScrollArea className="h-[calc(100vh-8rem)] pr-3">
      <div className="space-y-2">
        {sorted.map((s, i) => (
          <button
            key={`${s.document}-${s.page_number}-${i}`}
            onClick={() => onSelect(s.document, s.page_number, s.section_title)}
            className="group w-full rounded-xl border p-3 text-left transition hover:shadow-elegant focus:outline-none focus:ring-2 focus:ring-ring/60 bg-card/50"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium text-sm line-clamp-2 group-hover:text-primary">{s.section_title}</div>
              <Badge>p.{s.page_number}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">{s.document}</div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};

export default SectionsList;
