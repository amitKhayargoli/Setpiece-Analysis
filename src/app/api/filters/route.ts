import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface Event {
  id: number;
  eventId: number;
  eventName: string;
  subEventName: string;
  matchId: number;
  teamId: number;
  teamName: string;
  playerId: number;
  playerName: string;
  matchPeriod: string;
  eventSec: number;
  posX1: number;
  posY1: number;
  posX2?: number;
  posY2?: number;
}

// Cache data
let eventsCache: Event[] | null = null;
let teamsCache: any[] | null = null;

function getEvents(): Event[] {
  if (eventsCache) return eventsCache;
  
  const dataPath = path.join(process.cwd(), 'data', 'events.json');
  if (!fs.existsSync(dataPath)) {
    return [];
  }
  
  const data = fs.readFileSync(dataPath, 'utf8');
  eventsCache = JSON.parse(data);
  return eventsCache || [];
}

function getTeams(): any[] {
  if (teamsCache) return teamsCache;
  
  const dataPath = path.join(process.cwd(), 'data', 'teams.json');
  if (!fs.existsSync(dataPath)) {
    return [];
  }
  
  const data = fs.readFileSync(dataPath, 'utf8');
  teamsCache = JSON.parse(data);
  return teamsCache || [];
}

export async function GET() {
  try {
    const events = getEvents();
    const teams = getTeams();
    
    // Extract unique values
    const teamsList = [...new Set(events.map(e => e.teamName))].sort();
    const subEvents = [...new Set(events.map(e => e.subEventName))].sort();
    const players = [...new Set(events.map(e => e.playerName))].sort();
    
    // Create sub-event categories
    const setPieceTypes = [
      { id: 'Corner', label: 'Corner' },
      { id: 'Throw in', label: 'Throw In' },
      { id: 'Free Kick', label: 'Free Kick' },
      { id: 'Free kick shot', label: 'Free Kick Shot' },
      { id: 'Free kick cross', label: 'Free Kick Cross' },
      { id: 'Penalty', label: 'Penalty' },
      { id: 'Shot', label: 'Shot (from set piece)' },
    ];
    
    return NextResponse.json({
      teams: teams.map(t => ({ id: t.name, label: t.name })),
      subEvents: setPieceTypes.filter(se => subEvents.includes(se.id)),
      players: players.map(p => ({ id: p, label: p })),
      gameweeks: Array.from({ length: 38 }, (_, i) => ({ id: i + 1, label: `Gameweek ${i + 1}` }))
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filters' },
      { status: 500 }
    );
  }
}
