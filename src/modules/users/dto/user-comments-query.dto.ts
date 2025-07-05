import { IsOptional, Min, Max, IsIn, IsDateString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UserCommentsQueryDto {
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @IsOptional()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'most_replies'])
  sortBy?: 'newest' | 'oldest' | 'most_replies';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  topLevelOnly?: boolean; 

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  minReplies?: number; // filter by popularity
}
