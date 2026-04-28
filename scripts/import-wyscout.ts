import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { isGoalFromTags, isSetPieceEvent, mapSetPieceType, periodRank } from "../src/backend/set-piece";

type WyscoutPosition = { x: number; y: number };
type WyscoutTag = { id: number };

type WyscoutEvent = {
  id: number;
  eventId: number;
  eventName: string;
  subEventName: string;
  matchId: number;
  teamId: number;
  playerId: number;
  matchPeriod: string;
  eventSec: number;
  tags: WyscoutTag[];
  positions: WyscoutPosition[];
};

type WyscoutTeam = {
  wyId: number;
  name: string;
  officialName?: string;
  city?: string;
  area?: { name?: string };
};

type WyscoutPlayer = {
  wyId: number;
  firstName?: string;
  lastName?: string;
  shortName?: string;
  foot?: string;
  birthDate?: string;
  role?: { name?: string };
  currentTeamId?: number | string | null;
};

type WyscoutMatch = {
  wyId: number;
  gameweek?: number;
  date?: string;
  venue?: string;
  label?: string;
  teamsData?: Record<string, { side?: string }>;
};

type NormalizedEvent = {
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
  tags: WyscoutTag[];
  positions: WyscoutPosition[];
  raw: WyscoutEvent;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const TEAM_CHUNK_SIZE = 2000;
const PLAYER_CHUNK_SIZE = 1000;
const MATCH_CHUNK_SIZE = 1000;
const EVENT_CHUNK_SIZE = 150;
const SET_PIECE_CHUNK_SIZE = 500;

function readJson<T>(dataDir: string, filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename), "utf8")) as T;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toDateOrNull(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIntOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "null" || normalized === "undefined") {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}

function isEnglishPremierLeagueMatch(match: WyscoutMatch): boolean {
  const teamIds = Object.keys(match.teamsData ?? {}).map(Number);
  return teamIds.length === 2;
}

function extractHomeAway(match: WyscoutMatch): { homeTeamId: number; awayTeamId: number } | null {
  if (!match.teamsData) {
    return null;
  }

  let homeTeamId: number | null = null;
  let awayTeamId: number | null = null;

  for (const [teamIdRaw, teamData] of Object.entries(match.teamsData)) {
    const teamId = Number(teamIdRaw);
    if (teamData.side === "home") {
      homeTeamId = teamId;
    }
    if (teamData.side === "away") {
      awayTeamId = teamId;
    }
  }

  if (homeTeamId && awayTeamId) {
    return { homeTeamId, awayTeamId };
  }

  const teamIds = Object.keys(match.teamsData).map(Number);
  if (teamIds.length !== 2) {
    return null;
  }
  return { homeTeamId: teamIds[0], awayTeamId: teamIds[1] };
}

function extractPremierLeagueTeamIds(matches: WyscoutMatch[]): Set<number> {
  const ids = new Set<number>();
  for (const match of matches) {
    const teams = extractHomeAway(match);
    if (!teams) {
      continue;
    }
    ids.add(teams.homeTeamId);
    ids.add(teams.awayTeamId);
  }
  return ids;
}

function extractPremierLeaguePlayerIds(events: WyscoutEvent[]): Set<number> {
  const ids = new Set<number>();
  for (const event of events) {
    if (Number.isInteger(event.playerId) && event.playerId > 0) {
      ids.add(event.playerId);
    }
  }
  return ids;
}

function makeEventUid(matchId: number, eventIndex: number, id: number): string {
  return `${matchId}:${eventIndex}:${id}`;
}

function eventSort(a: WyscoutEvent, b: WyscoutEvent): number {
  const periodDelta = periodRank(a.matchPeriod) - periodRank(b.matchPeriod);
  if (periodDelta !== 0) {
    return periodDelta;
  }
  return a.eventSec - b.eventSec;
}

async function upsertTeams(teams: WyscoutTeam[]): Promise<void> {
  const data = teams.map((team) => ({
    id: team.wyId,
    name: team.name,
    officialName: team.officialName ?? null,
    city: team.city ?? null,
    areaName: team.area?.name ?? null,
  }));

  for (const teamChunk of chunk(data, TEAM_CHUNK_SIZE)) {
    await prisma.team.createMany({ data: teamChunk, skipDuplicates: true });
  }
}

async function upsertPlayers(players: WyscoutPlayer[], validTeamIds: Set<number>): Promise<void> {
  const data = players.map((player) => {
    const normalizedTeamId = toIntOrNull(player.currentTeamId);
    return {
      id: player.wyId,
      firstName: player.firstName ?? null,
      lastName: player.lastName ?? null,
      shortName: player.shortName ?? null,
      roleName: player.role?.name ?? null,
      foot: player.foot ?? null,
      birthDate: toDateOrNull(player.birthDate),
      currentTeamId: normalizedTeamId && validTeamIds.has(normalizedTeamId) ? normalizedTeamId : null,
    };
  });

  for (const playerChunk of chunk(data, PLAYER_CHUNK_SIZE)) {
    await prisma.player.createMany({ data: playerChunk, skipDuplicates: true });
  }
}

async function upsertMatches(matches: WyscoutMatch[]): Promise<void> {
  const data = matches
    .filter(isEnglishPremierLeagueMatch)
    .map((match) => {
      const teams = extractHomeAway(match);
      if (!teams) {
        return null;
      }
      return {
        id: match.wyId,
        gameweek: match.gameweek ?? null,
        dateUtc: toDateOrNull(match.date),
        venue: match.venue ?? null,
        label: match.label ?? null,
        homeTeamId: teams.homeTeamId,
        awayTeamId: teams.awayTeamId,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  for (const matchChunk of chunk(data, MATCH_CHUNK_SIZE)) {
    await prisma.match.createMany({ data: matchChunk, skipDuplicates: true });
  }
}

async function upsertEvents(events: WyscoutEvent[]): Promise<void> {
  const data = normalizeEvents(events).map((event) => {
    const uid = event.uid;

    return {
      uid,
      eventIndex: event.eventIndex,
      eventId: event.eventId,
      eventName: event.eventName,
      subEventName: event.subEventName,
      matchId: event.matchId,
      teamId: event.teamId,
      playerId: event.playerId,
      matchPeriod: event.matchPeriod,
      eventSec: event.eventSec,
      startX: event.startX,
      startY: event.startY,
      endX: event.endX,
      endY: event.endY,
      tags: event.tags ?? [],
      positions: event.positions,
      raw: event.raw,
    };
  });

  for (const eventChunk of chunk(data, EVENT_CHUNK_SIZE)) {
    await prisma.event.createMany({ data: eventChunk, skipDuplicates: true });
  }
}

function normalizeEvents(events: WyscoutEvent[]): NormalizedEvent[] {
  return events.map((event, index) => {
    const uid = makeEventUid(event.matchId, index, event.id);
    const start = event.positions[0] ?? { x: 0, y: 0 };
    const end = event.positions[1] ?? null;

    return {
      uid,
      eventIndex: index,
      eventId: event.eventId,
      eventName: event.eventName,
      subEventName: event.subEventName,
      matchId: event.matchId,
      teamId: event.teamId,
      playerId: event.playerId || null,
      matchPeriod: event.matchPeriod,
      eventSec: event.eventSec,
      startX: start.x,
      startY: start.y,
      endX: end?.x ?? null,
      endY: end?.y ?? null,
      tags: event.tags ?? [],
      positions: event.positions,
      raw: event,
    };
  });
}

function buildSetPieces(events: NormalizedEvent[]): Array<{
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
}> {
  const byMatch = new Map<number, NormalizedEvent[]>();

  for (const event of events) {
    const list = byMatch.get(event.matchId) ?? [];
    list.push(event);
    byMatch.set(event.matchId, list);
  }

  const setPieces: ReturnType<typeof buildSetPieces> = [];

  for (const [matchId, matchEvents] of byMatch.entries()) {
    matchEvents.sort(eventSort);

    for (const event of matchEvents) {
      if (!isSetPieceEvent(event)) {
        continue;
      }

      const sourceUid = event.uid;

      const linkedShot = matchEvents.find((candidate) => {
        if (candidate.eventName !== "Shot") {
          return false;
        }
        if (candidate.teamId !== event.teamId) {
          return false;
        }
        if (candidate.matchPeriod !== event.matchPeriod) {
          return false;
        }
        const delta = candidate.eventSec - event.eventSec;
        return delta >= 0 && delta <= 20;
      });

      const linkedShotUid = linkedShot ? linkedShot.uid : null;

      setPieces.push({
        id: `sp:${sourceUid}`,
        sourceEventUid: sourceUid,
        matchId,
        teamId: event.teamId,
        playerId: event.playerId,
        type: mapSetPieceType(event.subEventName),
        subType: event.subEventName,
        matchPeriod: event.matchPeriod,
        eventSec: event.eventSec,
        startX: event.startX,
        startY: event.startY,
        endX: event.endX,
        endY: event.endY,
        linkedShotUid,
        outcomeType: linkedShot ? "shot" : null,
        isGoal: linkedShot ? isGoalFromTags(linkedShot.tags) : null,
      });
    }
  }

  return setPieces;
}

async function upsertSetPieces(events: WyscoutEvent[]): Promise<void> {
  const normalized = normalizeEvents(events);
  const setPieces = buildSetPieces(normalized);

  for (const setPieceChunk of chunk(setPieces, SET_PIECE_CHUNK_SIZE)) {
    await prisma.setPiece.createMany({ data: setPieceChunk, skipDuplicates: true });
  }
}

async function main(): Promise<void> {
  const dataDir = process.env.WYSCOUT_DATA_DIR ?? "D:/sem 6/wyscout_pl/Data";

  const teams = readJson<WyscoutTeam[]>(dataDir, "teams.json");
  const players = readJson<WyscoutPlayer[]>(dataDir, "players.json");
  const matches = readJson<WyscoutMatch[]>(dataDir, "matches_England.json");
  const events = readJson<WyscoutEvent[]>(dataDir, "events_England.json");

  const premierLeagueTeamIds = extractPremierLeagueTeamIds(matches);
  const premierLeaguePlayerIds = extractPremierLeaguePlayerIds(events);
  const premierLeagueTeams = teams.filter((team) => premierLeagueTeamIds.has(team.wyId));
  const premierLeaguePlayers = players.filter((player) => premierLeaguePlayerIds.has(player.wyId));

  console.log(`Ingesting from ${dataDir}`);
  console.log(
    `teams=${premierLeagueTeams.length}/${teams.length} players=${premierLeaguePlayers.length}/${players.length} matches=${matches.length} events=${events.length}`,
  );

  const validTeamIds = new Set(premierLeagueTeams.map((team) => team.wyId));

  await upsertTeams(premierLeagueTeams);
  await upsertPlayers(premierLeaguePlayers, validTeamIds);
  await upsertMatches(matches);
  await upsertEvents(events);
  await upsertSetPieces(events);

  const [teamCount, playerCount, matchCount, eventCount, setPieceCount] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.match.count(),
    prisma.event.count(),
    prisma.setPiece.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        imported: {
          teams: teamCount,
          players: playerCount,
          matches: matchCount,
          events: eventCount,
          setPieces: setPieceCount,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
