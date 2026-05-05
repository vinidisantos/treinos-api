export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class WorkoutPlanNotActiveError extends Error {
  constructor(message: string = "Workout plan is not active") {
    super(message);
    this.name = "WorkoutPlanNotActiveError";
  }
}

export class WorkoutSessionAlreadyStartedError extends Error {
  constructor(message: string = "Workout session already started for this day") {
    super(message);
    this.name = "WorkoutSessionAlreadyStartedError";
  }
}
