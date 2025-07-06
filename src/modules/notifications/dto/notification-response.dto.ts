import { Expose, Transform, Type } from 'class-transformer';


export class NotificationUserDto {
  @Expose()
  id: string;

  @Expose()
  username: string;
}

export class NotificationCommentDto {
  @Expose()
  id: string;

  @Expose()
  @Transform(({ value }) => value?.substring(0, 100) + (value?.length > 100 ? '...' : ''))
  text: string;

  @Expose()
  @Type(() => Date)
  createdAt: Date;
}

export class NotificationResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: 'reply' | 'mention' | 'comment_deleted' | 'system';

  @Expose()
  title: string;

  @Expose()
  message: string;

  @Expose()
  isRead: boolean;

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  readAt: Date | null;

  @Expose()
  @Type(() => NotificationUserDto)
  @Transform(({ obj }) => obj.fromUser)
  fromUser: NotificationUserDto | null;

  @Expose()
  @Type(() => NotificationCommentDto)
  @Transform(({ obj }) => obj.relatedComment)
  relatedComment: NotificationCommentDto | null;

  @Expose()
  actionUrl: string | null;

  @Expose()
  priority: 'low' | 'medium' | 'high';

  @Expose()
  @Transform(({ obj }) => ({
    canMarkAsRead: !obj.isRead,
    canDelete: true,
    isExpired: obj.createdAt && new Date(obj.createdAt).getTime() < Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days
  }))
  actions: {
    canMarkAsRead: boolean;
    canDelete: boolean;
    isExpired: boolean;
  };
}
