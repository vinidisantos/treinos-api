import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import {
  NotFoundError,
  WorkoutPlanNotActiveError,
  WorkoutSessionAlreadyStartedError,
} from "../errors/index.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, WorkoutPlanSchema } from "../schemas/index.js";
import {
  CreateWorkoutPlan,
  CreateWorkoutPlanOutputDto,
} from "../usecases/CreateWorkoutPlan.js";
import { GetWorkoutPlan } from "../usecases/GetWorkoutPlan.js";
import { StartWorkoutSession } from "../usecases/StartWorkoutSession.js";
import { UpdateWorkoutSession } from "../usecases/UpdateWorkoutSession.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["Workout Plan"],
      summary: "Create a workout plan",
      body: WorkoutPlanSchema.omit({ id: true }).partial(),
      response: {
        201: WorkoutPlanSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }
        const createWorkoutPlan = new CreateWorkoutPlan();
        const result: CreateWorkoutPlanOutputDto =
          await createWorkoutPlan.execute({
            userId: session.user.id,
            name: request.body.name ?? "",
            workoutDays: request.body.workoutDays ?? [],
          });
        return reply.status(201).send({
          ...result,
          workoutDays: result.workoutDays.map((day) => ({
            ...day,
            coverImageUrl: day.coverImageUrl ?? undefined,
          })),
        });
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      tags: ["Workout Plan"],
      summary: "Get a workout plan by id",
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          name: z.string(),
          workoutDays: z.array(
            z.object({
              id: z.string().uuid(),
              weekDay: z.string(),
              name: z.string(),
              isRest: z.boolean(),
              coverImageUrl: z.string().url().optional(),
              estimatedDurationInSeconds: z.number(),
              exercisesCount: z.number(),
            }),
          ),
        }),
        401: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const getWorkoutPlan = new GetWorkoutPlan();
        const result = await getWorkoutPlan.execute({
          userId: session.user.id,
          workoutPlanId: request.params.id,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply.status(404).send({ error: error.message, code: "NOT_FOUND" });
        }
        return reply.status(500).send({ error: "Internal server error", code: "INTERNAL_SERVER_ERROR" });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/:workoutPlanId/days/:workoutDayId/sessions",
    schema: {
      tags: ["Workout Plan"],
      summary: "Start a workout session",
      params: z.object({
        workoutPlanId: z.string().uuid(),
        workoutDayId: z.string().uuid(),
      }),
      response: {
        201: z.object({ userWorkoutSessionId: z.string().uuid() }),
        401: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
        422: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply
            .status(401)
            .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const startWorkoutSession = new StartWorkoutSession();
        const result = await startWorkoutSession.execute({
          userId: session.user.id,
          workoutPlanId: request.params.workoutPlanId,
          workoutDayId: request.params.workoutDayId,
        });

        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply
            .status(404)
            .send({ error: error.message, code: "NOT_FOUND" });
        }
        if (error instanceof WorkoutPlanNotActiveError) {
          return reply
            .status(422)
            .send({ error: error.message, code: "WORKOUT_PLAN_NOT_ACTIVE" });
        }
        if (error instanceof WorkoutSessionAlreadyStartedError) {
          return reply.status(409).send({
            error: error.message,
            code: "WORKOUT_SESSION_ALREADY_STARTED",
          });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/:workoutPlanId/days/:workoutDayId/sessions/:sessionId",
    schema: {
      tags: ["Workout Plan"],
      summary: "Update a workout session",
      params: z.object({
        workoutPlanId: z.string().uuid(),
        workoutDayId: z.string().uuid(),
        sessionId: z.string().uuid(),
      }),
      body: z.object({
        completedAt: z.iso.datetime(),
      }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          completedAt: z.iso.datetime(),
          startedAt: z.iso.datetime(),
        }),
        401: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const updateWorkoutSession = new UpdateWorkoutSession();
        const result = await updateWorkoutSession.execute({
          userId: session.user.id,
          workoutPlanId: request.params.workoutPlanId,
          workoutDayId: request.params.workoutDayId,
          sessionId: request.params.sessionId,
          completedAt: new Date(request.body.completedAt),
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply.status(404).send({ error: error.message, code: "NOT_FOUND" });
        }
        return reply.status(500).send({ error: "Internal server error", code: "INTERNAL_SERVER_ERROR" });
      }
    },
  });
};
