import { IsString, IsEnum, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'ID of the user who will receive the notification',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  recipientId: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: ['reply', 'mention', 'comment_deleted', 'system'],
    example: 'reply'
  })
  @IsEnum(['reply', 'mention', 'comment_deleted', 'system'])
  type: 'reply' | 'mention' | 'comment_deleted' | 'system';

  @ApiProperty({
    description: 'Title of the notification',
    minLength: 1,
    maxLength: 100,
    example: 'New Reply'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'Notification message content',
    minLength: 1,
    maxLength: 500,
    example: 'Someone replied to your comment'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message: string;

  @ApiPropertyOptional({
    description: 'ID of the user who triggered the notification',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  fromUserId?: string;

  @ApiPropertyOptional({
    description: 'ID of the related comment',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  relatedCommentId?: string;

  @ApiPropertyOptional({
    description: 'URL for the notification action',
    maxLength: 255,
    example: '/comments/123'
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  actionUrl?: string;

  @ApiPropertyOptional({
    description: 'Priority level of the notification',
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    example: 'medium'
  })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high' = 'medium';

  @ApiPropertyOptional({
    description: 'Additional metadata for the notification',
    example: { key: 'value' }
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
