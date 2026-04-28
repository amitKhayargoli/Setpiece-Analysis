"use client";

import { useState } from "react";
import { Team, Match } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { PitchVisualization } from "@/components/pitch-visualization";

export function ClientLayout({ teams, matches }: { teams: Team[]; matches: Match[] }) {
  const [selectedSetPieceId, setSelectedSetPieceId] = useState<string | undefined>();

  return (
    <main className="flex h-screen w-full overflow-hidden">
      {/* Sidebar for Filters & Set-Piece List */}
      <aside className="w-80 border-r bg-muted/20 flex flex-col shrink-0">
        <Sidebar 
          teams={teams} 
          matches={matches} 
          selectedSetPieceId={selectedSetPieceId}
          onSelectSetPiece={setSelectedSetPieceId}
        />
      </aside>

      {/* Main Pitch Visualization Area */}
      <section className="flex-1 flex flex-col bg-background relative overflow-hidden">
        <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card">
          <h1 className="font-semibold">Match Simulation</h1>
        </header>
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-muted/10">
          <PitchVisualization selectedSetPieceId={selectedSetPieceId} />
        </div>
      </section>
    </main>
  );
}