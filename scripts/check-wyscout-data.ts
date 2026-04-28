import fs from "node:fs";
import path from "node:path";

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
  positions: Array<{ x: number; y: number }>;
};

type WyscoutMatch = {
  wyId: number;
  gameweek?: number;
  date?: string;
  teamsData?: Record<string, { side?: string }>;
};

type WyscoutTeam = { wyId: number; name: string; area?: { name?: string } };
type WyscoutPlayer = { wyId: number; shortName?: string };

const dataDir = process.env.WYSCOUT_DATA_DIR ?? path.join(process.cwd(), "..", "Data");

function readJson<T>(filename: string): T {
  const filePath = path.join(dataDir, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function main(): void {
  const events = readJson<WyscoutEvent[]>("events_England.json");
  const matches = readJson<WyscoutMatch[]>("matches_England.json");
  const teams = readJson<WyscoutTeam[]>("teams.json");
  const players = readJson<WyscoutPlayer[]>("players.json");

  const requiredFields: Array<keyof WyscoutEvent> = [
    "id",
    "eventId",
    "eventName",
    "subEventName",
    "matchId",
    "teamId",
    "playerId",
    "matchPeriod",
    "eventSec",
    "positions",
  ];

  const missingFieldCounts = Object.fromEntries(requiredFields.map((f) => [f, 0])) as Record<
    keyof WyscoutEvent,
    number
  >;

  let invalidPositions = 0;
  let invalidPositionRange = 0;

  for (const event of events) {
    for (const field of requiredFields) {
      if (!(field in event) || event[field] === null || event[field] === undefined) {
        missingFieldCounts[field] += 1;
      }
    }

    if (!Array.isArray(event.positions) || event.positions.length === 0) {
      invalidPositions += 1;
      continue;
    }

    for (const pos of event.positions) {
      const valid = isFiniteNumber(pos.x) && isFiniteNumber(pos.y);
      if (!valid) {
        invalidPositions += 1;
        continue;
      }
      if (pos.x < 0 || pos.x > 100 || pos.y < 0 || pos.y > 100) {
        invalidPositionRange += 1;
      }
    }
  }

  const matchIdSet = new Set(matches.map((m) => m.wyId));
  const teamIdSet = new Set(teams.map((t) => t.wyId));
  const playerIdSet = new Set(players.map((p) => p.wyId));

  let orphanMatchRefs = 0;
  let orphanTeamRefs = 0;
  let orphanPlayerRefs = 0;

  for (const event of events) {
    if (!matchIdSet.has(event.matchId)) {
      orphanMatchRefs += 1;
    }
    if (!teamIdSet.has(event.teamId)) {
      orphanTeamRefs += 1;
    }
    if (event.playerId !== 0 && !playerIdSet.has(event.playerId)) {
      orphanPlayerRefs += 1;
    }
  }

  const setPieceSubEvents = [
    "Corner",
    "Throw in",
    "Free Kick",
    "Free kick cross",
    "Free kick shot",
    "Penalty",
  ];

  const setPieceCandidateCount = events.filter(
    (event) => event.eventName === "Free Kick" || setPieceSubEvents.includes(event.subEventName),
  ).length;

  const normalizationReady =
    Object.values(missingFieldCounts).every((count) => count === 0) &&
    invalidPositions === 0 &&
    invalidPositionRange === 0 &&
    orphanMatchRefs === 0 &&
    orphanTeamRefs === 0;

  const report = {
    dataDir,
    counts: {
      events: events.length,
      matches: matches.length,
      teams: teams.length,
      players: players.length,
      setPieceCandidates: setPieceCandidateCount,
    },
    missingFieldCounts,
    invalidPositions,
    invalidPositionRange,
    orphanReferences: {
      match: orphanMatchRefs,
      team: orphanTeamRefs,
      player: orphanPlayerRefs,
    },
    normalizationReady,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!normalizationReady) {
    process.exitCode = 1;
  }
}

main();
