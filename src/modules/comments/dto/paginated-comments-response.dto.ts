import { Expose, Type } from 'class-transformer';
import { CommentResponseDto } from './comment-response.dto';
import { PaginationMetaDto } from './pagination-meta.dto';

// this is the response for the paginated comments
// validates that the data is an array of CommentResponseDto and the meta is a PaginationMetaDto
export class PaginatedCommentsResponseDto {
  @Expose()
  @Type(() => CommentResponseDto)
  data: CommentResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  meta: PaginationMetaDto;
}