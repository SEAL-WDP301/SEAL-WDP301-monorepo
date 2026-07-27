import { PartialType } from "@nestjs/swagger";
import { RegisterTeamDto } from "./register-team.dto";

export class UpdateTeamRegistrationDto extends PartialType(RegisterTeamDto) {}
