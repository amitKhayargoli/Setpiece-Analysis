type RawTag = { id: number };

type RawEvent = {
  id: number;
  eventName: string;
  subEventName: string;
  eventSec: number;
  matchPeriod: string;
  teamId: number;
  tags?: RawTag[];
};

const SET_PIECE_SUB_TYPES = new Set([
  "Corner",
  "Throw in",
  "Free Kick",
  "Free kick cross",
  "Free kick shot",
  "Penalty",
  "Goal kick",
]);

export function isSetPieceEvent(event: RawEvent): boolean {
  return event.eventName === "Free Kick" || SET_PIECE_SUB_TYPES.has(event.subEventName);
}

export function mapSetPieceType(subEventName: string): string {
  if (subEventName === "Corner") {
    return "corner";
  }
  if (subEventName === "Throw in") {
    return "throw_in";
  }
  if (subEventName === "Penalty") {
    return "penalty";
  }
  if (subEventName === "Goal kick") {
    return "goal_kick";
  }
  return "free_kick";
}

export function isGoalFromTags(tags: RawTag[] | undefined): boolean {
  if (!tags) {
    return false;
  }
  return tags.some((tag) => tag.id === 101);
}

export function periodRank(period: string): number {
  if (period === "1H") {
    return 1;
  }
  if (period === "2H") {
    return 2;
  }
  if (period === "E1") {
    return 3;
  }
  if (period === "E2") {
    return 4;
  }
  if (period === "P") {
    return 5;
  }
  return 6;
}
