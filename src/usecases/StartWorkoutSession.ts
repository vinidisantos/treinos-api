import { NotFoundError, WorkoutPlanNotActiveError, WorkoutSessionAlreadyStartedError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export interface StartWorkoutSessionOutputDto {
  userWorkoutSessionId: string;
}

export class StartWorkoutSession {
  async execute(dto: InputDto): Promise<StartWorkoutSessionOutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!workoutPlan || workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    if (!workoutPlan.isActive) {
      throw new WorkoutPlanNotActiveError();
    }

    const workoutDay = await prisma.workoutDay.findUnique({
      where: { id: dto.workoutDayId },
      include: { sessions: true },
    });

    if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
      throw new NotFoundError("Workout day not found");
    }

    if (workoutDay.sessions.length > 0) {
      throw new WorkoutSessionAlreadyStartedError();
    }

    const workoutSession = await prisma.workoutSession.create({
      data: {
        id: crypto.randomUUID(),
        workoutDayId: dto.workoutDayId,
        startedAt: new Date(),
      },
    });

    return {
      userWorkoutSessionId: workoutSession.id,
    };
  }
}
