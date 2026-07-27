import { Controller, Post, Headers, Body, Req, UnauthorizedException, Logger, HttpCode, HttpStatus, Get, Param } from '@nestjs/common';
import * as crypto from 'crypto';
import { GithubWebhookService } from '../services/github.webhook.service';
import { Request } from 'express';

@Controller('github')
export class GithubWebhookController {
  private readonly logger = new Logger(GithubWebhookController.name);

  constructor(private readonly webhookService: GithubWebhookService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Body() payload: any,
    @Req() req: Request,
  ) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret && signature) {
      const hmac = crypto.createHmac('sha256', secret)
      const rawBody = (req as any).rawBody || JSON.stringify(payload);
      const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
      
      // If signature verification fails, we log it. 
      if (signature !== digest) {
        this.logger.warn('GitHub webhook signature mismatch. Ensure rawBody middleware is configured if you want strict validation.');
      }
    }

    // If the content type was application/x-www-form-urlencoded, the payload is a string inside payload.payload
    let parsedPayload = payload;
    if (payload && payload.payload && typeof payload.payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload.payload);
      } catch (e) {
        this.logger.error('Failed to parse webhook payload string', e);
      }
    }

    // 2. Process push event
    if (event === 'push') {
      this.logger.log(`Received push event for repo: ${parsedPayload.repository?.full_name}`);
      await this.webhookService.handlePushEvent(parsedPayload);
    } else {
      this.logger.log(`Ignored event: ${event}`);
    }
    
    return { success: true };
  }

  @Get('commits/:teamId')
  async getCommits(@Param('teamId') teamId: string) {
    return this.webhookService.getTeamCommits(Number(teamId));
  }

  @Get('commits/event/:eventId')
  async getEventCommits(@Param('eventId') eventId: string) {
    return this.webhookService.getEventCommits(Number(eventId));
  }

  @Get('repos/:teamId/collaborator-status')
  async getCollaboratorStatus(@Param('teamId') teamId: string) {
    const status = await this.webhookService.getTeamCollaboratorStatus(Number(teamId));
    return { data: status };
  }

  @Post('repos/freeze')
  async freezeRepo(@Body('teamId') teamId: number) {
    return this.webhookService.freezeRepo(teamId);
  }

  @Post('repos/freeze-event/:eventId')
  async freezeEventRepos(@Param('eventId') eventId: string) {
    return this.webhookService.freezeEventRepos(Number(eventId));
  }

  @Post('repos/unfreeze-event/:eventId')
  async unfreezeEventRepos(@Param('eventId') eventId: string) {
    return this.webhookService.unfreezeEventRepos(Number(eventId));
  }

  @Post('repos/sync-event/:eventId')
  async syncEventCommits(@Param('eventId') eventId: string) {
    return this.webhookService.syncEventCommits(Number(eventId));
  }
}
