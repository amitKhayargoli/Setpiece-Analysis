export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

export interface Team {
  id: number;
  name: string;
  officialName: string | null;
  city: string | null;
  areaName: string | null;
}

export interface Match {
  id: number;
  gameweek: number | null;
  dateUtc: string | null;
  homeTeamId: number;
  awayTeamId: number;
  venue: string | null;
  label: string | null;
  homeTeam: Team;
  awayTeam: Team;
}

export interface EventPosition {
  x: number;
  y: number;
}

export interface EventTag {
  id: number;
}

export interface SourceEvent {
  uid: string;
  eventIndex: number;
  eventId: number;
  eventName: string;
  subEventName: string;
  matchId: number;
  teamId: number;
  playerId: number | null;
  matchPeriod: string;
  eventSec: number;
  startX: number;
  startY: number;
  endX: number | null;
  endY: number | null;
  tags: EventTag[];
  positions: EventPosition[];
  raw: any;
}

export interface Player {
  id: number;
  firstName: string | null;
  lastName: string | null;
  shortName: string | null;
  roleName: string | null;
  foot: string | null;
  birthDate: string | null;
  currentTeamId: number | null;
}

export interface SetPiece {
  id: string;
  sourceEventUid: string;
  matchId: number;
  teamId: number;
  playerId: number | null;
  type: string;
  subType: string;
  matchPeriod: string;
  eventSec: number;
  startX: number;
  startY: number;
  endX: number | null;
  endY: number | null;
  linkedShotUid: string | null;
  outcomeType: string | null;
  isGoal: boolean | null;
  team: Team;
  player: Player | null;
  match: Match;
  sourceEvent?: SourceEvent;
}

export async function fetchTeams(limit = 100, offset = 0): Promise<PaginatedResponse<Team>> {
  const url = new URL(`${API_BASE_URL}/api/teams`);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch teams");
  return res.json();
}

export async function fetchMatches(limit = 500, offset = 0, gameweek?: number): Promise<PaginatedResponse<Match>> {
  const url = new URL(`${API_BASE_URL}/api/matches`);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  if (gameweek) url.searchParams.set("gameweek", gameweek.toString());

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch matches");
  return res.json();
}

export async function fetchSetPieces({
  limit = 200,
  offset = 0,
  teamId,
  matchId,
  type,
  gameweek,
}: {
  limit?: number;
  offset?: number;
  teamId?: number;
  matchId?: number;
  type?: string;
  gameweek?: number;
}): Promise<PaginatedResponse<SetPiece>> {
  const url = new URL(`${API_BASE_URL}/api/set-pieces`);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  if (teamId) url.searchParams.set("teamId", teamId.toString());
  if (matchId) url.searchParams.set("matchId", matchId.toString());
  if (type) url.searchParams.set("type", type);
  if (gameweek) url.searchParams.set("gameweek", gameweek.toString());

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch set pieces");
  return res.json();
}

export async function fetchSetPieceById(id: string): Promise<SetPiece> {
  const url = new URL(`${API_BASE_URL}/api/set-pieces/${encodeURIComponent(id)}`);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch set piece details");
  return res.json();
}