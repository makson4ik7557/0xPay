import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {ConfigModule} from "@nestjs/config";
import { PrismaModule } from './prisma/prisma.module';
import {AuthModule} from './auth/auth.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({isGlobal:true}),
    PrismaModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
