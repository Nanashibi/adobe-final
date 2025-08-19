import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useConfig } from "@/components/app/ConfigContext";
import { getCombined, getStatus } from "@/services/api";
import ReaderShell from "@/components/reader/ReaderShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Reader = () => {
  const { collectionId = "" } = useParams();
  const { apiBaseUrl } = useConfig();
  const { data: status } = useQuery({
    queryKey: ["collection-status", collectionId, apiBaseUrl],
    queryFn: () => getStatus(apiBaseUrl, collectionId),
    enabled: !!apiBaseUrl && !!collectionId,
    refetchInterval: (query) => {
      const data = query.state.data as { status: string } | undefined;
      if (!data) return 1000;
      return data.status === "ready" || data.status === "error" ? false : 1000;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["combined", collectionId, apiBaseUrl],
    queryFn: () => getCombined(apiBaseUrl, collectionId),
    enabled: !!apiBaseUrl && !!collectionId && status?.status === "ready",
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  if (!status || status.status !== "ready") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Processing collection…</p>
      </main>
    );
  }
  if (error || !data || !collectionId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center space-y-3">
          <p className="text-muted-foreground">Failed to load data. Please try again.</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
        </Card>
      </main>
    );
  }

  return (
    <main>
      <ReaderShell collectionId={collectionId} data={data} />
    </main>
  );
};

export default Reader;
