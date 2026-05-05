import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export interface GetWorkoutDayOutputDto {
  id: string;
  name: string;
  isRest: boolean;
  coverImageUrl?: string;
  estimatedDurationInSeconds: number;
  weekDay: WeekDay;
  exercises: Array<{
    id: string;
    name: string;
    order: number;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
    workoutDayId: string;
  }>;
  sessions: Array<{
    id: string;
    workoutDayId: string;
    startedAt?: string;
    completedAt?: string;
  }>;
}

function toDateString(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

export class GetWorkoutDay {
  async execute(dto: InputDto): Promise<GetWorkoutDayOutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!workoutPlan || workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    const workoutDay = await prisma.workoutDay.findUnique({
      where: { id: dto.workoutDayId, workoutPlanId: dto.workoutPlanId },
      include: {
        exercices: {
          orderBy: { order: "asc" },
        },
        sessions: {
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day not found");
    }

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRestDay,
      coverImageUrl: workoutDay.coverImageUrl ?? undefined,
      estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
      weekDay: workoutDay.weekDay,
      exercises: workoutDay.exercices.map((ex) => ({
        id: ex.id,
        name: ex.name,
        order: ex.order,
        sets: ex.sets,
        reps: ex.reps,
        restTimeInSeconds: ex.restTimeInSeconds,
        workoutDayId: ex.workoutDayId,
      })),
      sessions: workoutDay.sessions.map((s) => ({
        id: s.id,
        workoutDayId: s.workoutDayId,
        startedAt: toDateString(s.startedAt),
        completedAt: toDateString(s.completedAt ?? undefined),
      })),
    };
  }
}
