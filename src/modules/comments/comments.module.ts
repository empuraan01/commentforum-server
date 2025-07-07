import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { commentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { CommentThreadsGateway } from './comments-threads.gateway';
import { Comment } from '../../entities/comment.entity';
import { User } from '../../entities/user.entity';
import { WebSocketThrottler } from '../../config/websocket-throttler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback-secret',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [CommentsController],
  providers: [
    commentsService,
    CommentThreadsGateway,
    WebSocketThrottler,
  ],
  exports: [
    commentsService,
    CommentThreadsGateway,
    TypeOrmModule
  ],
})
export class CommentsModule {}
