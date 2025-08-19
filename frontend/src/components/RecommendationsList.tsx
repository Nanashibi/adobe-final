import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecommendationsGroup } from "@/types/api";

interface RecommendationsListProps {
  groups: RecommendationsGroup[];
  onSelect: (doc: string, page: number, title: string) => void;
}

const RecommendationsList = ({ groups, onSelect }: RecommendationsListProps) => {
  return (
    <ScrollArea className="h-[calc(100vh-8rem)] pr-3">
      <div className="space-y-4">
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-xl border p-3 space-y-2">
            <div className="text-xs text-muted-foreground">Source: {g.source.document} • p.{g.source.page_number}</div>
            {g.recommendations.map((r, ri) => (
              <button
                key={ri}
                className="w-full rounded-lg bg-secondary p-3 text-left transition hover:shadow-elegant"
                onClick={() => onSelect(r.document, r.page_number, r.section_title)}
              >
                <div className="font-medium text-sm line-clamp-1">{r.section_title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.snippet}</div>
                <div className="text-xs text-muted-foreground mt-1">{r.document} • p.{r.page_number}</div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default RecommendationsList;
