import { NextRequest, NextResponse } from 'next/server';
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
  opponentTeamName?: string;
}

// Cache events data
let eventsCache: Event[] | null = null;

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const team = searchParams.get('team');
    const subEvent = searchParams.get('subEvent');
    const player = searchParams.get('player');
    const gameweek = searchParams.get('gameweek');
    
    let events = getEvents();
    
    // Apply filters
    if (team && team !== 'all') {
      events = events.filter(e => e.teamName === team);
    }
    
    if (subEvent && subEvent !== 'all') {
      events = events.filter(e => e.subEventName === subEvent);
    }
    
    if (player && player !== 'all') {
      events = events.filter(e => e.playerName === player);
    }
    
    if (gameweek && gameweek !== 'all') {
      const gw = parseInt(gameweek);
      events = events.filter(e => {
        // We need to calculate gameweek from matchId or store it
        // For now, return all and filter on client if needed
        return true;
      });
    }
    
    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
