import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * CurrentUser param decorator — extracts the authenticated user from request.
 *
 * NestJS Lifecycle position: Used inside route Handlers after JwtAuthGuard attaches req.user.
 * Flow: Middleware → Guard (attaches req.user) → Interceptor → Pipe → [Handler uses @CurrentUser]
 *
 * @example
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: UserEntity) {}
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If a specific property key is passed (e.g., @CurrentUser('id')), return that property
    return data ? user?.[data] : user;
  },
);
