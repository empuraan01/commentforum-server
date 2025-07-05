import { Expose, Type } from 'class-transformer';
import { CommentResponseDto } from '../../comments/dto/comment-response.dto';
import { PaginationMetaDto } from '../../comments/dto/pagination-meta.dto';

export class UserCommentsSummaryDto {
  @Expose()
  totalComments: number;

  @Expose()
  totalReplies: number;

  @Expose()
  deletedComments: number;

  @Expose()
  averageRepliesPerComment: number;

  @Expose()
  @Type(() => Date)
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}

export class PaginatedUserCommentsResponseDto {
  @Expose()
  @Type(() => CommentResponseDto)
  data: CommentResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  meta: PaginationMetaDto;

  @Expose()
  @Type(() => UserCommentsSummaryDto)
  summary: UserCommentsSummaryDto;
}