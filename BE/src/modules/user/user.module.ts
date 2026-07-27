import { Module } from "@nestjs/common";
import { UserService } from "./services/user.service";
import { UserController } from "./controllers/user.controller";

/**
 * UserModule — manages user data and profile operations.
 *
 * Exports UserService so AuthModule can use it for auth operations.
 */
@Module({
  imports: [],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
