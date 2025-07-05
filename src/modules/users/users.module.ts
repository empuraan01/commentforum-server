import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../entities/user.entity';
import { Comment } from '../../entities/comment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Comment])
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [
    UsersService,
  ],
})
export class UsersModule {}
