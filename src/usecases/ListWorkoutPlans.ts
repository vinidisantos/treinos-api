import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  active?: boolean;
}

export interface ListWorkoutPlansOutputDto {
  workoutPlans: Array<{
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    workoutDays: Array<{
      id: string;
      name: string;
      weekDay: WeekDay;
      isRestDay: boolean;
      coverImageUrl: string | null;
      estimatedDurationInSeconds: number;
      workoutPlanId: string;
      createdAt: Date;
      updatedAt: Date;
      exercices: Array<{
        id: string;
        name: string;
        order: number;
        sets: number;
        reps: number;
        restTimeInSeconds: number;
        workoutDayId: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
    }>;
  }>;
}

export class ListWorkoutPlans {
  async execute(dto: InputDto): Promise<ListWorkoutPlansOutputDto> {
    const workoutPlans = await prisma.workoutPlan.findMany({
      where: {
        userId: dto.userId,
        ...(dto.active !== undefined ? { isActive: dto.active } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        workoutDays: {
          include: {
            exercices: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    return { workoutPlans };
  }
}
