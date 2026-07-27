import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { EventPublicService } from "../services/event.public.service";

@ApiTags("Public/Events")
@Controller("public/events")
export class EventPublicController {
  constructor(private readonly eventPublicService: EventPublicService) {}

  @Get()
  @ApiOperation({ summary: "Get all public events (active, ongoing, closed)" })
  async getAllPublicEvents() {
    const events = await this.eventPublicService.getAllPublicEvents();
    return { message: "Events fetched", data: events };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get public event details" })
  async getPublicEventById(@Param("id", ParseIntPipe) id: number) {
    const event = await this.eventPublicService.getPublicEventById(id);
    return { message: "Event details fetched", data: event };
  }
}
