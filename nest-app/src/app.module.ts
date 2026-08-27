import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {ConfigModule, ConfigService} from "@nestjs/config";
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { PrismaModule } from './prisma/prisma.module';
import {AuthModule} from './auth/auth.module';
import { WalletsModule } from './wallets/wallets.module';
import { InvoicesModule } from './invoices/invoices.module';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal:true}),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    PrismaModule,
    AuthModule,
    WalletsModule,
    InvoicesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
