import { IsString, IsEnum, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateNotificationDto {
  @IsUUID()
  recipientId: string;

  @IsEnum(['reply', 'mention', 'comment_deleted', 'system'])
  type: 'reply' | 'mention' | 'comment_deleted' | 'system';

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsUUID()
  fromUserId?: string;

  @IsOptional()
  @IsUUID()
  relatedCommentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  actionUrl?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high' = 'medium';

  @IsOptional()
  metadata?: Record<string, any>;
}
