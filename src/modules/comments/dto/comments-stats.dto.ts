import { Expose, Type } from 'class-transformer';


// this is the response validation for the statistics like number of comments and replies
export class CommentStatsDto {
  @Expose()
  totalComments: number;

  @Expose()
  totalReplies: number;

  @Expose()
  @Type(() => Date)
  mostActiveDay: Date;

  @Expose()
  averageCommentsPerDay: number;

  @Expose()
  topCommentId?: string;  // Most replied-to comment

  @Expose()
  @Type(() => Date)
  lastCommentAt?: Date;
}
