import { IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';

export class UpdateNotificationDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

export class BulkUpdateNotificationsDto {
  @IsOptional()
  @IsBoolean()
  markAllAsRead?: boolean;

  @IsOptional()
  @IsBoolean()
  deleteRead?: boolean;

  @IsOptional()
  @IsBoolean()
  deleteExpired?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  notificationIds?: string[];

  @IsOptional()
  @IsUUID()
  fromUserId?: string;
}
