import { Expose, Type } from 'class-transformer';
import { PaginationMetaDto } from '../../comments/dto/pagination-meta.dto';
import { NotificationResponseDto } from './notification-response.dto';

export class NotificationsSummaryDto {
  @Expose()
  totalNotifications: number;

  @Expose()
  unreadCount: number;

  @Expose()
  expiredCount: number;

  @Expose()
  byType: {
    reply: number;
    mention: number;
    comment_deleted: number;
    system: number;
  };

  @Expose()
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };

  @Expose()
  @Type(() => Date)
  lastNotificationAt: Date | null;

  @Expose()
  @Type(() => Date)
  lastReadAt: Date | null;
}

export class PaginatedNotificationsResponseDto {
  @Expose()
  @Type(() => NotificationResponseDto)
  data: NotificationResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  meta: PaginationMetaDto;

  @Expose()
  @Type(() => NotificationsSummaryDto)
  summary: NotificationsSummaryDto;
}

