import { Transform, Type } from 'class-transformer';
import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max, IsDateString, IsUUID } from 'class-validator';

export class NotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['newest', 'oldest', 'unread_first', 'priority'])
  sortBy?: 'newest' | 'oldest' | 'unread_first' | 'priority' = 'newest';

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  unreadOnly?: boolean = false;

  @IsOptional()
  @IsEnum(['reply', 'mention', 'comment_deleted', 'system'])
  type?: 'reply' | 'mention' | 'comment_deleted' | 'system';

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeExpired?: boolean = false;

  @IsOptional()
  @IsUUID()
  fromUserId?: string;
}
