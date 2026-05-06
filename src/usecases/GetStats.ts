import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

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
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface GetStatsOutputDto {
  workoutStreak: number;
  consistencyByDay: {
    [key: string]: {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    };
  };
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(dto: InputDto): Promise<GetStatsOutputDto> {
    const from = dayjs.utc(dto.from, "YYYY-MM-DD").startOf("day");
    const to = dayjs.utc(dto.to, "YYYY-MM-DD").endOf("day");

    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: { workoutPlan: { userId: dto.userId } },
        startedAt: {
          gte: from.toDate(),
          lte: to.toDate(),
        },
      },
    });

    const consistencyByDay: GetStatsOutputDto["consistencyByDay"] = {};
    let completedWorkoutsCount = 0;
    let totalTimeInSeconds = 0;

    for (const session of sessions) {
      const dateKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");

      if (!consistencyByDay[dateKey]) {
        consistencyByDay[dateKey] = {
          workoutDayCompleted: false,
          workoutDayStarted: false,
        };
      }

      consistencyByDay[dateKey].workoutDayStarted = true;

      if (session.completedAt) {
        consistencyByDay[dateKey].workoutDayCompleted = true;
        completedWorkoutsCount++;
        const durationMs =
          session.completedAt.getTime() - session.startedAt.getTime();
        totalTimeInSeconds += Math.floor(durationMs / 1000);
      }
    }

    const totalSessions = sessions.length;
    const conclusionRate =
      totalSessions === 0 ? 0 : completedWorkoutsCount / totalSessions;

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: { workoutDays: true },
    });

    let workoutStreak = 0;

    if (activeWorkoutPlan) {
      const planDaysByJsDay = new Set<number>(
        activeWorkoutPlan.workoutDays.map((d) => WEEK_DAY_TO_JS_DAY[d.weekDay]),
      );

      const historicalSessions = await prisma.workoutSession.findMany({
        where: {
          workoutDay: { workoutPlan: { userId: dto.userId } },
          startedAt: {
            gte: to.subtract(1, "year").toDate(),
            lte: to.toDate(),
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

      let currentDate = dayjs.utc(dto.to, "YYYY-MM-DD");
      for (let i = 0; i < 365; i++) {
        const jsDay = currentDate.day();
        if (planDaysByJsDay.has(jsDay)) {
          const key = currentDate.format("YYYY-MM-DD");
          const daySession = sessionsByDate.get(key);
          if (daySession?.completed) {
            workoutStreak++;
          } else {
            break;
          }
        }
        currentDate = currentDate.subtract(1, "day");
      }
    }

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }
}
