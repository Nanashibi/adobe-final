import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInsights } from "@/services/api";
import { useConfig } from "@/components/app/ConfigContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Zap, AlertTriangle, Link } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface InsightsBulbProps {
  collectionId: string;
  llmProvider?: string;
}

const InsightsBulb = ({ collectionId, llmProvider }: InsightsBulbProps) => {
  const { apiBaseUrl } = useConfig();
  const [shouldGenerate, setShouldGenerate] = useState(false);
  
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['insights', collectionId, llmProvider],
    queryFn: () => getInsights(apiBaseUrl, collectionId, llmProvider),
    enabled: !!apiBaseUrl && !!collectionId && shouldGenerate,
  });

  if (isLoading) {
    return (
      <Card className="p-3">
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      </Card>
    );
  }

  if (!shouldGenerate) {
    return (
      <Card className="p-4">
        <div className="text-center">
          <Lightbulb className="mx-auto mb-3 h-12 w-12 text-yellow-500" />
          <h3 className="font-semibold text-lg mb-2">AI Insights</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get AI-powered insights, contradictions, and connections from your documents
          </p>
          <Button onClick={() => setShouldGenerate(true)} className="w-full">
            <Lightbulb className="h-4 w-4 mr-2" />
            Generate Insights
          </Button>
        </div>
      </Card>
    );
  }

  if (error || (!insights && !isLoading)) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <Lightbulb className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">Unable to generate insights</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShouldGenerate(false)} 
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <ScrollArea className="h-[calc(50vh-2rem)]">
        <div className="p-4 space-y-4">
          {/* Executive Summary */}
          {insights.executive_summary && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <Lightbulb className="h-4 w-4" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-relaxed">{insights.executive_summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Key Insights */}
          {insights.key_insights.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {insights.key_insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Badge variant="secondary" className="mt-0.5 text-xs">
                        {i + 1}
                      </Badge>
                      <span className="text-sm leading-relaxed">{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Did You Know */}
          {insights.did_you_know.length > 0 && (
            <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <Lightbulb className="h-4 w-4" />
                  Did You Know?
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {insights.did_you_know.map((fact, i) => (
                    <li key={i} className="text-sm leading-relaxed">
                      • {fact}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Contradictions */}
          {insights.contradictions.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
                  <AlertTriangle className="h-4 w-4" />
                  Contradictions & Counterpoints
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {insights.contradictions.map((contradiction, i) => (
                    <li key={i} className="text-sm leading-relaxed">
                      ⚠️ {contradiction}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Connections */}
          {insights.connections.length > 0 && (
            <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                  <Link className="h-4 w-4" />
                  Cross-Document Connections
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {insights.connections.map((connection, i) => (
                    <li key={i} className="text-sm leading-relaxed">
                      🔗 {connection}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default InsightsBulb;
