import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
}

export interface GetUserTrainDataOutputDto {
  userId: string;
  userName: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

export class GetUserTrainData {
  async execute(dto: InputDto): Promise<GetUserTrainDataOutputDto | null> {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
      include: { trainData: true },
    });

    if (!user || !user.trainData) {
      return null;
    }

    return {
      userId: user.id,
      userName: user.name,
      weightInGrams: user.trainData.weightInGrams,
      heightInCentimeters: user.trainData.heightInCentimeters,
      age: user.trainData.age,
      bodyFatPercentage: user.trainData.bodyFatPercentage,
    };
  }
}
