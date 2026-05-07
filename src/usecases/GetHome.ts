import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

type WeekDayLiteral =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

dayjs.extend(utc);

const WEEK_DAY_TO_JS_DAY: Record<WeekDay, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

interface InputDto {
  userId: string;
  date: string; // YYYY-MM-DD
}

export interface GetHomeOutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDayLiteral;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercisesCount: number;
  } | null;
  workoutStreak: number;
  consistencyByDay: {
    [key: string]: {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    };
  };
}

export class GetHome {
  async execute(dto: InputDto): Promise<GetHomeOutputDto> {
    const date = dayjs.utc(dto.date, "YYYY-MM-DD");
    const weekStart = date.startOf("week"); // Sunday 00:00:00 UTC
    const weekEnd = date.endOf("week"); // Saturday 23:59:59.999 UTC

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: {
        workoutDays: {
          include: {
            exercices: true,
            sessions: {
              where: {
                startedAt: {
                  gte: weekStart.toDate(),
                  lte: weekEnd.toDate(),
                },
              },
            },
          },
        },
      },
    });

    const todayJsDay = date.day();
    const todayWorkoutDayData =
      activeWorkoutPlan?.workoutDays.find(
        (day) => WEEK_DAY_TO_JS_DAY[day.weekDay] === todayJsDay,
      ) ?? null;

    const consistencyByDay: GetHomeOutputDto["consistencyByDay"] = {};
    for (let i = 0; i < 7; i++) {
      const key = weekStart.add(i, "day").format("YYYY-MM-DD");
      consistencyByDay[key] = {
        workoutDayCompleted: false,
        workoutDayStarted: false,
      };
    }

    for (const workoutDay of activeWorkoutPlan?.workoutDays ?? []) {
      for (const session of workoutDay.sessions) {
        const dateKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
        if (consistencyByDay[dateKey] !== undefined) {
          consistencyByDay[dateKey].workoutDayStarted = true;
          if (session.completedAt) {
            consistencyByDay[dateKey].workoutDayCompleted = true;
          }
        }
      }
    }

    const historicalSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: { workoutPlan: { userId: dto.userId } },
        startedAt: {
          gte: date.subtract(1, "year").toDate(),
          lte: weekEnd.toDate(),
        },
      },
    });

    const sessionsByDate = new Map<string, { completed: boolean }>();
    for (const session of historicalSessions) {
      const key = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
      const existing = sessionsByDate.get(key);
      if (!existing) {
        sessionsByDate.set(key, { completed: !!session.completedAt });
      } else if (!existing.completed && session.completedAt) {
        sessionsByDate.set(key, { completed: true });
      }
    }

    const planDaysByJsDay = new Set<number>(
      activeWorkoutPlan?.workoutDays.map(
        (d) => WEEK_DAY_TO_JS_DAY[d.weekDay],
      ) ?? [],
    );

    let streak = 0;
    let currentDate = date;
    for (let i = 0; i < 365; i++) {
      const jsDay = currentDate.day();
      if (planDaysByJsDay.has(jsDay)) {
        const key = currentDate.format("YYYY-MM-DD");
        const daySession = sessionsByDate.get(key);
        if (daySession?.completed) {
          streak++;
        } else {
          break;
        }
      }
      currentDate = currentDate.subtract(1, "day");
    }

    return {
      activeWorkoutPlanId: activeWorkoutPlan?.id ?? "",
      todayWorkoutDay: todayWorkoutDayData
        ? {
            workoutPlanId: todayWorkoutDayData.workoutPlanId,
            id: todayWorkoutDayData.id,
            name: todayWorkoutDayData.name,
            isRest: todayWorkoutDayData.isRestDay,
            weekDay: todayWorkoutDayData.weekDay as WeekDayLiteral,
            estimatedDurationInSeconds:
              todayWorkoutDayData.estimatedDurationInSeconds,
            coverImageUrl: todayWorkoutDayData.coverImageUrl ?? undefined,
            exercisesCount: todayWorkoutDayData.exercices.length,
          }
        : null,
      workoutStreak: streak,
      consistencyByDay,
    };
  }
}
