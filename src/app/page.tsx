import { fetchTeams, fetchMatches } from "@/lib/api";
import { ClientLayout } from "@/components/client-layout";

export default async function Home() {
  const [teamsRes, matchesRes] = await Promise.all([
    fetchTeams(100),
    fetchMatches(500),
  ]);

  return <ClientLayout teams={teamsRes.items} matches={matchesRes.items} />;
}