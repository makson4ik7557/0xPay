import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NodesEventsModule } from './nodes-events.module';

async function bootstrap() {
  const app = await NestFactory.create(NodesEventsModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<string>('NE_PORT'));
}
void bootstrap();
