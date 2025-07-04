import { IsOptional, Min, Max, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

// this is the query for the replies. we are querying for the replies to a specific comment
export class ReplyQueryDto {
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @IsOptional()
  @Min(1)
  @Max(50)  
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number;

  @IsOptional()
  @IsIn(['oldest', 'newest'])
  sortBy?: string;

  @IsOptional()
  @Min(1)
  @Max(5)
  @Transform(({ value }) => parseInt(value, 10))
  maxDepth?: number;
}