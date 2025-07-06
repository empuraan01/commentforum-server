import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { commentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { CommentThreadsGateway } from './comments-threads.gateway';
import { Comment } from '../../entities/comment.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [CommentsController],
  providers: [commentsService, CommentThreadsGateway],
  exports: [
    commentsService,
    CommentThreadsGateway,
    TypeOrmModule
  ],
})
export class CommentsModule {}
