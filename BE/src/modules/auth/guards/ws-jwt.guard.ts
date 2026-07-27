import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = this.extractTokenFromHeader(client);

      if (!token) {
        throw new WsException("Unauthorized");
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("jwt.accessSecret"),
      });

      // Attach user payload to the socket instance for future use
      client.data.user = payload;
      return true;
    } catch (err) {
      this.logger.error("WebSocket Authentication failed", err);
      throw new WsException("Unauthorized");
    }
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.split(" ")[1];
    return token;
  }
}
