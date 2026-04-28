import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = 'D:\\sem 6\\wyscout_pl\\Data';
const OUTPUT_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Loading data files...');

// Load teams and filter for England
const teamsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teams.json'), 'utf8'));
const englishTeams = teamsData.filter((t: any) => t.area?.name === 'England');
const englishTeamIds = new Set(englishTeams.map((t: any) => t.wyId));

console.log(`Found ${englishTeams.length} English teams`);

// Create team lookup
const teamLookup = new Map();
for (const team of englishTeams) {
  teamLookup.set(team.wyId, {
    id: team.wyId,
    name: team.name,
    officialName: team.officialName,
    city: team.city
  });
}

// Load players
const playersData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'players.json'), 'utf8'));
const playerLookup = new Map();
for (const player of playersData) {
  playerLookup.set(player.wyId, {
    id: player.wyId,
    firstName: player.firstName,
    lastName: player.lastName,
    shortName: player.shortName,
    role: player.role?.name
  });
}
console.log(`Loaded ${playersData.length} players`);

// Load matches and filter for English teams
const matchesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'matches_England.json'), 'utf8'));
const matchLookup = new Map();
for (const match of matchesData) {
  const teamIds = Object.keys(match.teamsData || {}).map(Number);
  const isEnglishMatch = teamIds.every(id => englishTeamIds.has(id));
  
  if (isEnglishMatch && teamIds.length === 2) {
    matchLookup.set(match.wyId, {
      id: match.wyId,
      gameweek: match.gameweek,
      date: match.date,
      team1Id: teamIds[0],
      team2Id: teamIds[1],
      team1Name: teamLookup.get(teamIds[0])?.name || 'Unknown',
      team2Name: teamLookup.get(teamIds[1])?.name || 'Unknown'
    });
  }
}
console.log(`Loaded ${matchLookup.size} matches with English teams`);

// Load and filter events
console.log('Loading events (this may take a while)...');
const eventsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events_England.json'), 'utf8'));
console.log(`Loaded ${eventsData.length} total events`);

// Filter set-piece events
const setPieceSubEvents = ['Corner', 'Throw in', 'Free Kick', 'Penalty', 'Free kick cross', 'Free kick shot'];

const setPieceEvents = eventsData.filter((e: any) => {
  // Only include events from English teams
  if (!englishTeamIds.has(e.teamId)) return false;
  
  // Include set pieces
  if (e.eventName === 'Free Kick' && setPieceSubEvents.includes(e.subEventName)) {
    return true;
  }
  
  // Include shots that might be from set pieces
  if (e.eventName === 'Shot') {
    return true;
  }
  
  return false;
});

console.log(`Filtered to ${setPieceEvents.length} set-piece and shot events`);

// Enrich events with team and player names
const enrichedEvents = setPieceEvents.map((e: any) => {
  const team = teamLookup.get(e.teamId);
  const player = playerLookup.get(e.playerId);
  const match = matchLookup.get(e.matchId);
  
  return {
    ...e,
    teamName: team?.name || 'Unknown',
    playerName: player?.shortName || player?.firstName + ' ' + player?.lastName || 'Unknown',
    playerRole: player?.role || null,
    matchGameweek: match?.gameweek || null,
    opponentTeamId: match ? (match.team1Id === e.teamId ? match.team2Id : match.team1Id) : null,
    opponentTeamName: match ? (match.team1Id === e.teamId ? match.team2Name : match.team1Name) : 'Unknown'
  };
});

// Save filtered data
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'teams.json'),
  JSON.stringify(Array.from(teamLookup.values()))
);

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'events.json'),
  JSON.stringify(enrichedEvents)
);

// Create summary stats
const stats = {
  totalEvents: enrichedEvents.length,
  byType: {} as Record<string, number>,
  bySubType: {} as Record<string, number>,
  byTeam: {} as Record<string, number>,
  byGameweek: {} as Record<number, number>
};

for (const event of enrichedEvents) {
  // By event type
  stats.byType[event.eventName] = (stats.byType[event.eventName] || 0) + 1;
  
  // By sub type
  stats.bySubType[event.subEventName] = (stats.bySubType[event.subEventName] || 0) + 1;
  
  // By team
  stats.byTeam[event.teamName] = (stats.byTeam[event.teamName] || 0) + 1;
  
  // By gameweek
  if (event.matchGameweek) {
    stats.byGameweek[event.matchGameweek] = (stats.byGameweek[event.matchGameweek] || 0) + 1;
  }
}

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'stats.json'),
  JSON.stringify(stats, null, 2)
);

console.log('Data processing complete!');
console.log('Stats:', stats);
console.log('\nOutput files:');
console.log('- data/teams.json');
console.log('- data/events.json');
console.log('- data/stats.json');
