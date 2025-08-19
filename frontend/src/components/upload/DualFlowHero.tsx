import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Zap, Brain, Search } from "lucide-react";
import BulkAnalysisFlow from "./BulkAnalysisFlow";
import QuickReadFlow from "./QuickReadFlow";

type FlowMode = "select" | "bulk" | "quick";

export default function DualFlowHero() {
  const [mode, setMode] = useState<FlowMode>("select");

  if (mode === "bulk") {
    return <BulkAnalysisFlow onBack={() => setMode("select")} />;
  }

  if (mode === "quick") {
    return <QuickReadFlow onBack={() => setMode("select")} />;
  }

  return (
    <main className="min-h-[calc(100vh-2rem)] flex flex-col items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20">
      <header className="text-center max-w-4xl mb-12">
        <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent mb-4">
          Adobe Document Intelligence
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          Choose your document analysis approach
        </p>
        <p className="text-sm text-muted-foreground">
          Powered by Adobe PDF technology and AI
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-8 w-full max-w-5xl px-4">
        {/* Bulk Analysis Flow */}
        <Card className="relative overflow-hidden border-2 hover:border-orange-200 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-100/50 group cursor-pointer"
              onClick={() => setMode("bulk")}>
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-orange-500/5 to-yellow-500/5 group-hover:from-red-500/10 group-hover:via-orange-500/10 group-hover:to-yellow-500/10 transition-all duration-300" />
          
          <CardHeader className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white">
                <Brain className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Bulk Document Analysis</CardTitle>
            </div>
            <CardDescription className="text-base">
              Upload multiple PDFs for comprehensive analysis with persona-driven insights
            </CardDescription>
          </CardHeader>
          
          <CardContent className="relative space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-orange-500" />
                <span>Multiple PDF upload</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-orange-500" />
                <span>Persona & job-specific analysis</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Search className="h-4 w-4 text-orange-500" />
                <span>Cross-document insights & connections</span>
              </div>
            </div>
            
            <Button className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white">
              Start Bulk Analysis
            </Button>
          </CardContent>
        </Card>

        {/* Quick Read Flow */}
        <Card className="relative overflow-hidden border-2 hover:border-blue-200 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-100/50 group cursor-pointer"
              onClick={() => setMode("quick")}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-teal-500/5 group-hover:from-blue-500/10 group-hover:via-cyan-500/10 group-hover:to-teal-500/10 transition-all duration-300" />
          
          <CardHeader className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                <Zap className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Quick Read & Explore</CardTitle>
            </div>
            <CardDescription className="text-base">
              Upload a single PDF for instant reading with AI-powered text selection insights
            </CardDescription>
          </CardHeader>
          
          <CardContent className="relative space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-blue-500" />
                <span>Instant PDF reading</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Search className="h-4 w-4 text-blue-500" />
                <span>Select text → get AI explanations</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-blue-500" />
                <span>Generalized knowledge + document context</span>
              </div>
            </div>
            
            <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white">
              Start Quick Read
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>Built for Adobe Hackathon 2025 • Powered by Adobe PDF Embed API</p>
      </footer>
    </main>
  );
}
