import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notification.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { Comment } from '../../entities/comment.entity';
import { WebSocketThrottler } from '../../config/websocket-throttler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      User,
      Comment,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback-secret',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    WebSocketThrottler,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
  ],
})
export class NotificationsModule {} 