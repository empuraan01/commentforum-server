import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { commentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Comment } from '../../entities/comment.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, User])
  ],
  controllers: [CommentsController],
  providers: [commentsService],
  exports: [
    commentsService,
    TypeOrmModule
  ],
})
export class CommentsModule {}
