import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

import { env } from "./env";
import { prisma } from "./db";

const app = Fastify({ logger: true });

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const setPieceQuerySchema = z.object({
  teamId: z.coerce.number().int().positive().optional(),
  matchId: z.coerce.number().int().positive().optional(),
  type: z.string().optional(),
  gameweek: z.coerce.number().int().min(1).max(38).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

async function registerRoutes(): Promise<void> {
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/api/teams", async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query", details: query.error.flatten() });
    }

    const [items, total] = await Promise.all([
      prisma.team.findMany({
        orderBy: { name: "asc" },
        take: query.data.limit,
        skip: query.data.offset,
      }),
      prisma.team.count(),
    ]);

    return { total, items };
  });

  app.get("/api/matches", async (request, reply) => {
    const query = listQuerySchema.extend({ gameweek: z.coerce.number().int().min(1).max(38).optional() }).safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query", details: query.error.flatten() });
    }

    const where = query.data.gameweek ? { gameweek: query.data.gameweek } : undefined;

    const [items, total] = await Promise.all([
      prisma.match.findMany({
        where,
        orderBy: [{ gameweek: "asc" }, { dateUtc: "asc" }],
        include: {
          homeTeam: true,
          awayTeam: true,
        },
        take: query.data.limit,
        skip: query.data.offset,
      }),
      prisma.match.count({ where }),
    ]);

    return { total, items };
  });

  app.get("/api/set-pieces", async (request, reply) => {
    const query = setPieceQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query", details: query.error.flatten() });
    }

    const where = {
      ...(query.data.teamId ? { teamId: query.data.teamId } : {}),
      ...(query.data.matchId ? { matchId: query.data.matchId } : {}),
      ...(query.data.type ? { type: query.data.type } : {}),
      ...(query.data.gameweek
        ? {
            match: {
              gameweek: query.data.gameweek,
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.setPiece.findMany({
        where,
        include: {
          team: true,
          player: true,
          match: {
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          },
        },
        orderBy: [{ matchId: "asc" }, { eventSec: "asc" }],
        take: query.data.limit,
        skip: query.data.offset,
      }),
      prisma.setPiece.count({ where }),
    ]);

    return { total, items };
  });

  app.get("/api/set-pieces/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid set piece id" });
    }

    const item = await prisma.setPiece.findUnique({
      where: { id: params.data.id },
      include: {
        sourceEvent: true,
        team: true,
        player: true,
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
      },
    });

    if (!item) {
      return reply.code(404).send({ error: "Set piece not found" });
    }

    return item;
  });
}

async function start(): Promise<void> {
  await registerRoutes();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

start().catch(async (error) => {
  app.log.error(error);
  await app.close();
  process.exit(1);
});
