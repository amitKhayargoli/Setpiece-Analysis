"use client";

import { useState, useEffect } from "react";
import { Team, Match, SetPiece, fetchSetPieces } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Sidebar({
  teams,
  matches,
  selectedSetPieceId,
  onSelectSetPiece,
}: {
  teams: Team[];
  matches: Match[];
  selectedSetPieceId?: string;
  onSelectSetPiece: (id: string) => void;
}) {
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("corner");
  const [setPieces, setSetPieces] = useState<SetPiece[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const filteredMatches = selectedTeam
    ? matches.filter(
        (m) =>
          m.homeTeamId === Number(selectedTeam) ||
          m.awayTeamId === Number(selectedTeam)
      )
    : [];

  useEffect(() => {
    console.log("Team Selected:", selectedTeam);
    console.log("Filtered Matches Count:", filteredMatches.length);
  }, [selectedTeam, filteredMatches]);

  useEffect(() => {
    let active = true;
    if (!selectedTeam || !selectedMatch) {
      setTimeout(() => {
        if (active) setSetPieces([]);
      }, 0);
      return;
    }

    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetchSetPieces({
          teamId: Number(selectedTeam),
          matchId: Number(selectedMatch),
          type: selectedType === "all" ? undefined : selectedType,
          limit: 100,
        });
        if (active) setSetPieces(res.items);
      } catch (err) {
        console.error("Failed to load set pieces", err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [selectedTeam, selectedMatch, selectedType]);

  console.log("Sidebar Render State:", {
    selectedTeam,
    selectedMatch,
    filteredMatchesCount: filteredMatches.length,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4 tracking-tight">
          Set-Piece Simulator
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Team</label>
            <Select
              value={selectedTeam}
              onValueChange={(val) => {
                setSelectedTeam(val || "");
                setSelectedMatch("");
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  {selectedTeam
                    ? teams.find((t) => t.id.toString() === selectedTeam)?.name
                    : "Select team..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Match</label>
            <div key={selectedTeam}>
              <Select value={selectedMatch} onValueChange={(val) => setSelectedMatch(val || "")} disabled={!selectedTeam}>
                <SelectTrigger>
                  <SelectValue>
                    {selectedMatch ? filteredMatches.find(m => m.id.toString() === selectedMatch)?.label : "Select match..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredMatches.map((match) => (
                    <SelectItem key={match.id} value={match.id.toString()}>
                      GW {match.gameweek}: {match.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              Set-Piece Type
            </label>
            <Select
              value={selectedType}
              onValueChange={(val) => setSelectedType(val || "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="corner">Corner</SelectItem>
                <SelectItem value="free_kick">Free Kick</SelectItem>
                <SelectItem value="throw_in">Throw In</SelectItem>
                <SelectItem value="penalty">Penalty</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-medium mb-2 leading-none">
          Results ({setPieces.length})
        </h3>
        <Card className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 flex flex-col gap-2">
              {!selectedTeam || !selectedMatch ? (
                <div className="text-sm text-muted-foreground text-center pt-8 p-4">
                  Select a team and match to view set-pieces.
                </div>
              ) : isLoading ? (
                <div className="text-sm text-muted-foreground text-center pt-8 p-4">
                  Loading...
                </div>
              ) : setPieces.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center pt-8 p-4">
                  No set-pieces found for this selection.
                </div>
              ) : (
                setPieces.map((sp) => {
                  const minute = Math.floor(sp.eventSec / 60);
                  const isSelected = selectedSetPieceId === sp.id;
                  return (
                    <Button
                      key={sp.id}
                      variant={isSelected ? "default" : "outline"}
                      className="justify-start text-left h-auto py-3 px-4"
                      onClick={() => onSelectSetPiece(sp.id)}
                    >
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex justify-between items-center w-full">
                          <span className="font-semibold capitalize">
                            {sp.type.replace("_", " ")}
                          </span>
                          <span className="text-xs">
                            {minute}&apos; ({sp.matchPeriod})
                          </span>
                        </div>
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs truncate max-w-[140px] opacity-80">
                            {sp.player?.shortName || "Unknown Player"}
                          </span>
                          {sp.isGoal && (
                            <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">
                              Goal
                            </span>
                          )}
                        </div>
                      </div>
                    </Button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
