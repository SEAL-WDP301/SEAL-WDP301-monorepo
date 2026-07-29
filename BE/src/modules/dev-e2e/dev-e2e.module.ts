import { Module } from '@nestjs/common';
import { E2eTesterController } from './e2e-tester.controller';
import { E2eTesterService } from './e2e-tester.service';

@Module({
  controllers: [E2eTesterController],
  providers: [E2eTesterService],
  exports: [E2eTesterService],
})
export class DevE2eModule {}
