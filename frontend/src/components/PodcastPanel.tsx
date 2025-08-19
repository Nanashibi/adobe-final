import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useConfig } from "./app/ConfigContext";
import { getPodcast, generatePodcast } from "@/services/api";
import { Play, Pause, Volume2, Clock, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const PodcastPanel = ({ collectionId }: { collectionId: string }) => {
  const { apiBaseUrl } = useConfig();
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedScript, setSelectedScript] = useState<number | null>(null);
  
  // Query for podcast status/data with polling when generating
  const { data: podcast, isLoading, error, refetch } = useQuery({
    queryKey: ['podcast', collectionId],
    queryFn: () => getPodcast(apiBaseUrl, collectionId),
    enabled: !!apiBaseUrl && !!collectionId,
    refetchInterval: (data) => {
      // Poll every 2 seconds if generating, stop polling otherwise
      if (data && 'status' in data && data.status === 'generating') {
        return 2000;
      }
      return false;
    },
    refetchIntervalInBackground: false,
  });
  
  // Mutation for starting podcast generation
  const generateMutation = useMutation({
    mutationFn: () => generatePodcast(apiBaseUrl, collectionId),
    onSuccess: (data) => {
      console.log('Podcast generation started:', data);
      // Start polling after successful generation start
      refetch();
    },
    onError: (error) => {
      console.error('Failed to start podcast generation:', error);
    },
  });

  const handlePlayPause = () => {
    if (isPlaying) {
      // Stop current speech
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      // Start speech synthesis
      if (podcast?.transcript) {
        const utterance = new SpeechSynthesisUtterance(podcast.transcript);
        utterance.rate = 0.9; // Slightly slower for better comprehension
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Loading initial status
  if (isLoading) {
    return (
      <Card className="p-3 space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-8 w-full" />
      </Card>
    );
  }

  // Safety check for unexpected data
  if (!podcast) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <Volume2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">Loading podcast...</p>
        </div>
      </Card>
    );
  }

  // Not started state
  if (podcast?.status === 'not_started') {
    return (
      <Card className="p-4">
        <div className="text-center">
          <Volume2 className="mx-auto mb-3 h-12 w-12 text-blue-500" />
          <h3 className="font-semibold text-lg mb-2">AI Podcast</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate a 2-5 minute audio overview of your documents with AI narration
          </p>
          <Button 
            onClick={() => generateMutation.mutate()} 
            disabled={generateMutation.isPending}
            className="w-full"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 mr-2" />
                Generate Podcast
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  // Generating state with progress
  if (podcast?.status === 'generating') {
    return (
      <Card className="p-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-12 w-12 text-blue-500 animate-spin" />
          <h3 className="font-semibold text-lg mb-2">Generating Podcast</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {podcast.message || 'Creating your AI-powered audio overview...'}
          </p>
          {podcast.progress && (
            <div className="space-y-2">
              <Progress value={podcast.progress} className="w-full" />
              <p className="text-xs text-muted-foreground">
                {podcast.progress}% complete
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            You can switch to other tabs while this generates in the background
          </p>
        </div>
      </Card>
    );
  }

  // Error state
  if (podcast?.status === 'error' || error) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <Volume2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm mb-2">{podcast?.message || 'Unable to generate podcast'}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="mt-2"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              'Try Again'
            )}
          </Button>
        </div>
      </Card>
    );
  }

  // Handle completed status or fallback to showing content if status is unexpected
  if (podcast?.status === 'completed' || (!podcast?.status && podcast?.title)) {
    // Completed podcast - show the content
    return (
    <Card className="p-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Volume2 className="h-4 w-4" />
          {podcast?.title || "AI Podcast"}
        </CardTitle>
        {podcast?.duration_estimate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {podcast.duration_estimate}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Audio Player */}
          {podcast?.audio_url ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  🎙️ High-Quality AI Voice
                </span>
              </div>
              <audio controls src={`${apiBaseUrl}${podcast.audio_url}`} className="w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePlayPause}
                  className="flex items-center gap-2"
                  disabled={!podcast?.transcript}
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isPlaying ? "Stop" : "Play Podcast"}
                </Button>
                {podcast?.transcript && (
                  <span className="text-xs text-muted-foreground">
                    🎧 Browser TTS (Fallback)
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                💡 AI-generated audio coming soon...
              </div>
            </div>
          )}

          {/* Script Sections */}
          {podcast?.script_sections && podcast.script_sections.length > 0 && (
            <ScrollArea className="h-64">
              <div className="space-y-2 pr-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Conversation Script</h4>
                {podcast.script_sections.map((section, i) => (
                  <Card
                    key={i}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedScript === i ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedScript(selectedScript === i ? null : i)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {section.speaker}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {section.timestamp}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {selectedScript === i ? section.content : `${section.content.slice(0, 100)}${section.content.length > 100 ? '...' : ''}`}
                    </p>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Full Transcript */}
          {podcast?.transcript && (
            <details className="group">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Full Transcript
              </summary>
              <ScrollArea className="h-32 mt-2">
                <div className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap pr-3">
                  {podcast.transcript}
                </div>
              </ScrollArea>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
    );
  }

  // Fallback for any unexpected status
  return (
    <Card className="p-4">
      <div className="text-center text-muted-foreground">
        <Volume2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">Unexpected podcast state: {podcast?.status || 'unknown'}</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="mt-2"
        >
          Refresh
        </Button>
      </div>
    </Card>
  );
};

export default PodcastPanel;
