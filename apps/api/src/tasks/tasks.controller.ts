import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { TodaysTasksResponse } from "@nelna/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { TasksService } from "./tasks.service";

@ApiTags("tasks")
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get("today")
  @ApiOperation({
    summary:
      "Role-aware 'Today's Tasks' dashboard payload (summary, task cards, widgets) for the current user",
  })
  getTodaysTasks(
    @CurrentUser() user: RequestUser,
    @Query("date") date?: string,
  ): Promise<TodaysTasksResponse> {
    return this.tasksService.getTodaysTasks(user, date);
  }
}
