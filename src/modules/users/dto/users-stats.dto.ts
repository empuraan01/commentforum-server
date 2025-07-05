import { Expose, Transform, Type } from 'class-transformer';

export class UserStatsDto {
  @Expose()
  totalComments: number;

  @Expose()
  totalReplies: number;

  @Expose()
  @Transform(({ obj }) => (obj.totalComments || 0) + (obj.totalReplies || 0))
  totalContributions: number;

  @Expose()
  @Type(() => Date)
  firstCommentAt: Date | null;

  @Expose()
  @Type(() => Date)
  lastCommentAt: Date | null;
}
