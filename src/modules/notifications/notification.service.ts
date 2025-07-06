import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { Comment } from '../../entities/comment.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto, BulkUpdateNotificationsDto } from './dto/update-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { PaginatedNotificationsResponseDto, NotificationsSummaryDto } from './dto/paginated-notifications-response.dto';
import { PaginationMetaDto } from '../comments/dto/pagination-meta.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    private entityManager: EntityManager,
    private eventEmitter: EventEmitter2, // this is for real time listening
  ) {}


  private notificationStatsCache = new Map<string, { data: NotificationsSummaryDto; timestamp: number }>();
  private readonly NOTIFICATION_STATS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes (shorter TTL for real-time data)

  
  async createNotification(createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
    try {
      return this.entityManager.transaction(async (transactionalEntityManager) => {

        const recipient = await transactionalEntityManager.findOne(User, {
          where: { id: createNotificationDto.recipientId }
        });

        if (!recipient) {
          throw new NotFoundException('Recipient user not found');
        }


        let fromUser;
        if (createNotificationDto.fromUserId) {
          fromUser = await transactionalEntityManager.findOne(User, {
            where: { id: createNotificationDto.fromUserId }
          });
          
          if (!fromUser) {
            throw new NotFoundException('From user not found');
          }


          if (createNotificationDto.fromUserId === createNotificationDto.recipientId) {
            throw new BadRequestException('Cannot create notification to yourself');
          }
        }


        let relatedComment;
        if (createNotificationDto.relatedCommentId) {
          relatedComment = await transactionalEntityManager.findOne(Comment, {
            where: { id: createNotificationDto.relatedCommentId }
          });
          
          if (!relatedComment) {
            throw new NotFoundException('Related comment not found');
          }
        }


        const existingNotification = await this.checkForDuplicateNotification(
          transactionalEntityManager,
          createNotificationDto
        );

        if (existingNotification) {
          return this.updateExistingNotification(existingNotification, createNotificationDto);
        }


        const notification = transactionalEntityManager.create(Notification, {
          recipientId: createNotificationDto.recipientId,
          type: createNotificationDto.type,
          title: createNotificationDto.title,
          message: createNotificationDto.message,
          fromUserId: createNotificationDto.fromUserId,
          relatedCommentId: createNotificationDto.relatedCommentId,
          actionUrl: createNotificationDto.actionUrl,
          priority: createNotificationDto.priority || 'medium',
          metadata: createNotificationDto.metadata || {},
          isRead: false,
          createdAt: new Date(),
        });

        const savedNotification = await transactionalEntityManager.save(notification);


        const fullNotification = await transactionalEntityManager
          .createQueryBuilder(Notification, 'notification')
          .leftJoinAndSelect('notification.recipient', 'recipient')
          .leftJoinAndSelect('notification.fromUser', 'fromUser')
          .leftJoinAndSelect('notification.relatedComment', 'relatedComment')
          .where('notification.id = :id', { id: savedNotification.id })
          .getOne();

        this.notificationStatsCache.delete(createNotificationDto.recipientId);

        this.eventEmitter.emit('notification.created', {
          notification: fullNotification,
          recipientId: createNotificationDto.recipientId,
        });

        return plainToClass(NotificationResponseDto, fullNotification, {
          excludeExtraneousValues: true,
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'createNotification');
    }
  }


  async createReplyNotification(commentId: string, replyId: string): Promise<void> {
    try {

      const originalComment = await this.commentRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.user', 'user')
        .where('comment.id = :commentId', { commentId })
        .getOne();

      if (!originalComment || !originalComment.user) {
        return;
      }


      const reply = await this.commentRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.user', 'user')
        .where('comment.id = :replyId', { replyId })
        .getOne();

      if (!reply || !reply.user) {
        return;
      }


      if (originalComment.userId === reply.userId) {
        return;
      }


      await this.createNotification({
        recipientId: originalComment.userId,
        type: 'reply',
        title: `New reply from ${reply.user.username}`,
        message: `${reply.user.username} replied to your comment: "${reply.text.substring(0, 100)}${reply.text.length > 100 ? '...' : ''}"`,
        fromUserId: reply.userId,
        relatedCommentId: replyId,
        actionUrl: `/comments/${commentId}#reply-${replyId}`,
        priority: 'medium',
        metadata: {
          originalCommentId: commentId,
          replyId: replyId,
          type: 'comment_reply'
        }
      });
    } catch (error) {
      console.error('Failed to create reply notification:', error);
    }
  }


  async createMentionNotification(commentId: string, mentionedUsernames: string[]): Promise<void> {
    try {

      const comment = await this.commentRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.user', 'user')
        .where('comment.id = :commentId', { commentId })
        .getOne();

      if (!comment || !comment.user) {
        return;
      }


      const mentionedUsers = await this.userRepository
        .createQueryBuilder('user')
        .where('user.username IN (:...usernames)', { usernames: mentionedUsernames })
        .getMany();


      const notificationPromises = mentionedUsers
        .filter(user => user.id !== comment.userId)
        .map(user => this.createNotification({
          recipientId: user.id,
          type: 'mention',
          title: `You were mentioned by ${comment.user.username}`,
          message: `${comment.user.username} mentioned you in a comment: "${comment.text.substring(0, 100)}${comment.text.length > 100 ? '...' : ''}"`,
          fromUserId: comment.userId,
          relatedCommentId: commentId,
          actionUrl: `/comments/${commentId}`,
          priority: 'high',
          metadata: {
            mentionType: 'username',
            commentId: commentId,
            mentionedUsername: user.username
          }
        }));

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Failed to create mention notifications:', error);
    }
  }

  
  async getUserNotifications(
    userId: string, 
    query: NotificationQueryDto
  ): Promise<PaginatedNotificationsResponseDto> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const offset = (page - 1) * limit;


      let queryBuilder = this.notificationRepository
        .createQueryBuilder('notification')
        .leftJoinAndSelect('notification.fromUser', 'fromUser')
        .leftJoinAndSelect('notification.relatedComment', 'relatedComment')
        .where('notification.recipientId = :userId', { userId });


      if (query.unreadOnly) {
        queryBuilder.andWhere('notification.isRead = false');
      }

      if (query.type) {
        queryBuilder.andWhere('notification.type = :type', { type: query.type });
      }

      if (query.priority) {
        queryBuilder.andWhere('notification.priority = :priority', { priority: query.priority });
      }

      if (query.fromUserId) {
        queryBuilder.andWhere('notification.fromUserId = :fromUserId', { fromUserId: query.fromUserId });
      }

      if (query.fromDate) {
        queryBuilder.andWhere('notification.createdAt >= :fromDate', { fromDate: query.fromDate });
      }

      if (query.toDate) {
        queryBuilder.andWhere('notification.createdAt <= :toDate', { toDate: query.toDate });
      }

      if (!query.includeExpired) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        queryBuilder.andWhere('notification.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo });
      }


      switch (query.sortBy) {
        case 'oldest':
          queryBuilder.orderBy('notification.createdAt', 'ASC');
          break;
        case 'unread_first':
          queryBuilder.orderBy('notification.isRead', 'ASC')
                      .addOrderBy('notification.createdAt', 'DESC');
          break;
        case 'priority':
          queryBuilder.orderBy(`
            CASE notification.priority 
              WHEN 'high' THEN 1 
              WHEN 'medium' THEN 2 
              WHEN 'low' THEN 3 
            END
          `, 'ASC')
          .addOrderBy('notification.createdAt', 'DESC');
          break;
        case 'newest':
        default:
          queryBuilder.orderBy('notification.createdAt', 'DESC');
          break;
      }


      const [notifications, totalItems, summaryData] = await Promise.all([
        queryBuilder.skip(offset).take(limit).getMany(),
        queryBuilder.getCount(),
        this.getUserNotificationsSummary(userId, query)
      ]);


      const notificationDtos = notifications.map(notification => 
        plainToClass(NotificationResponseDto, notification, { excludeExtraneousValues: true })
      );


      const totalPages = Math.ceil(totalItems / limit);
      const meta = plainToClass(PaginationMetaDto, {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      });

      return plainToClass(PaginatedNotificationsResponseDto, {
        data: notificationDtos,
        meta,
        summary: summaryData,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'getUserNotifications');
    }
  }

  
  private async getUserNotificationsSummary(
    userId: string, 
    query: NotificationQueryDto
  ): Promise<NotificationsSummaryDto> {

    const cached = this.notificationStatsCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this.NOTIFICATION_STATS_CACHE_TTL) {
      return cached.data;
    }


    let summaryQueryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.recipientId = :userId', { userId });


    if (query.type) {
      summaryQueryBuilder.andWhere('notification.type = :type', { type: query.type });
    }

    if (query.fromUserId) {
      summaryQueryBuilder.andWhere('notification.fromUserId = :fromUserId', { fromUserId: query.fromUserId });
    }

    if (query.fromDate) {
      summaryQueryBuilder.andWhere('notification.createdAt >= :fromDate', { fromDate: query.fromDate });
    }

    if (query.toDate) {
      summaryQueryBuilder.andWhere('notification.createdAt <= :toDate', { toDate: query.toDate });
    }

    if (!query.includeExpired) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      summaryQueryBuilder.andWhere('notification.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo });
    }


    const summaryResult = await this.entityManager.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
        COUNT(CASE WHEN created_at < NOW() - INTERVAL '30 days' THEN 1 END) as expired_count,
        
        -- By type
        COUNT(CASE WHEN type = 'reply' THEN 1 END) as reply_count,
        COUNT(CASE WHEN type = 'mention' THEN 1 END) as mention_count,
        COUNT(CASE WHEN type = 'comment_deleted' THEN 1 END) as comment_deleted_count,
        COUNT(CASE WHEN type = 'system' THEN 1 END) as system_count,
        
        -- By priority
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority_count,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count,
        
        -- Timestamps
        MAX(created_at) as last_notification_at,
        MAX(CASE WHEN is_read = true THEN read_at END) as last_read_at
        
      FROM notifications 
      WHERE recipient_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [userId]);

    const stats = summaryResult[0];
    
    const summary = plainToClass(NotificationsSummaryDto, {
      totalNotifications: parseInt(stats.total_notifications) || 0,
      unreadCount: parseInt(stats.unread_count) || 0,
      expiredCount: parseInt(stats.expired_count) || 0,
      byType: {
        reply: parseInt(stats.reply_count) || 0,
        mention: parseInt(stats.mention_count) || 0,
        comment_deleted: parseInt(stats.comment_deleted_count) || 0,
        system: parseInt(stats.system_count) || 0,
      },
      byPriority: {
        low: parseInt(stats.low_priority_count) || 0,
        medium: parseInt(stats.medium_priority_count) || 0,
        high: parseInt(stats.high_priority_count) || 0,
      },
      lastNotificationAt: stats.last_notification_at,
      lastReadAt: stats.last_read_at,
    });


    this.notificationStatsCache.set(userId, {
      data: summary,
      timestamp: Date.now()
    });

    return summary;
  }

  
  async updateNotification(
    notificationId: string, 
    userId: string, 
    updateDto: UpdateNotificationDto
  ): Promise<NotificationResponseDto> {
    try {
      return this.entityManager.transaction(async (transactionalEntityManager) => {

        const notification = await transactionalEntityManager
          .createQueryBuilder(Notification, 'notification')
          .leftJoinAndSelect('notification.fromUser', 'fromUser')
          .leftJoinAndSelect('notification.relatedComment', 'relatedComment')
          .where('notification.id = :id', { id: notificationId })
          .andWhere('notification.recipientId = :userId', { userId })
          .getOne();

        if (!notification) {
          throw new NotFoundException('Notification not found or access denied');
        }


        const updateData: Partial<Notification> = {};
        
        if (updateDto.isRead !== undefined) {
          updateData.isRead = updateDto.isRead;
          updateData.readAt = updateDto.isRead ? new Date() : undefined;
        }

        await transactionalEntityManager
          .createQueryBuilder()
          .update(Notification)
          .set(updateData)
          .where('id = :id', { id: notificationId })
          .execute();


        const updatedNotification = await transactionalEntityManager
          .createQueryBuilder(Notification, 'notification')
          .leftJoinAndSelect('notification.fromUser', 'fromUser')
          .leftJoinAndSelect('notification.relatedComment', 'relatedComment')
          .where('notification.id = :id', { id: notificationId })
          .getOne();

        this.notificationStatsCache.delete(userId);

        this.eventEmitter.emit('notification.updated', {
          notification: updatedNotification,
          recipientId: userId,
        });

        return plainToClass(NotificationResponseDto, updatedNotification, {
          excludeExtraneousValues: true,
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.handleDatabaseError(error, 'updateNotification');
    }
  }

  
  async bulkUpdateNotifications(
    userId: string, 
    bulkUpdateDto: BulkUpdateNotificationsDto
  ): Promise<{ affected: number; message: string }> {
    try {
      return this.entityManager.transaction(async (transactionalEntityManager) => {
        let affected = 0;
        let message = '';


        if (bulkUpdateDto.markAllAsRead) {
          const result = await transactionalEntityManager
            .createQueryBuilder()
            .update(Notification)
            .set({ 
              isRead: true, 
              readAt: new Date() 
            })
            .where('recipientId = :userId', { userId })
            .andWhere('isRead = false')
            .execute();
          
          affected = result.affected || 0;
          message = `Marked ${affected} notifications as read`;
        }


        if (bulkUpdateDto.deleteRead) {
          const result = await transactionalEntityManager
            .createQueryBuilder()
            .delete()
            .from(Notification)
            .where('recipientId = :userId', { userId })
            .andWhere('isRead = true')
            .execute();
          
          affected = result.affected || 0;
          message = `Deleted ${affected} read notifications`;
        }


        if (bulkUpdateDto.deleteExpired) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const result = await transactionalEntityManager
            .createQueryBuilder()
            .delete()
            .from(Notification)
            .where('recipientId = :userId', { userId })
            .andWhere('createdAt < :thirtyDaysAgo', { thirtyDaysAgo })
            .execute();
          
          affected = result.affected || 0;
          message = `Deleted ${affected} expired notifications`;
        }


        if (bulkUpdateDto.notificationIds && bulkUpdateDto.notificationIds.length > 0) {
          const result = await transactionalEntityManager
            .createQueryBuilder()
            .update(Notification)
            .set({ 
              isRead: true, 
              readAt: new Date() 
            })
            .where('id IN (:...ids)', { ids: bulkUpdateDto.notificationIds })
            .andWhere('recipientId = :userId', { userId })
            .execute();
          
          affected = result.affected || 0;
          message = `Updated ${affected} specific notifications`;
        }

        this.notificationStatsCache.delete(userId);

        this.eventEmitter.emit('notification.bulk_updated', {
          recipientId: userId,
          operation: bulkUpdateDto,
          affected,
        });

        return { affected, message };
      });
    } catch (error) {
      this.handleDatabaseError(error, 'bulkUpdateNotifications');
    }
  }

  
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      return this.entityManager.transaction(async (transactionalEntityManager) => {
        const notification = await transactionalEntityManager.findOne(Notification, {
          where: { 
            id: notificationId, 
            recipientId: userId 
          }
        });

        if (!notification) {
          throw new NotFoundException('Notification not found or access denied');
        }

        await transactionalEntityManager.delete(Notification, { id: notificationId });

        this.notificationStatsCache.delete(userId);

        this.eventEmitter.emit('notification.deleted', {
          notificationId,
          recipientId: userId,
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.handleDatabaseError(error, 'deleteNotification');
    }
  }

  
  private async checkForDuplicateNotification(
    entityManager: EntityManager,
    createDto: CreateNotificationDto
  ): Promise<Notification | null> {

    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    return entityManager
      .createQueryBuilder(Notification, 'notification')
      .where('notification.recipientId = :recipientId', { recipientId: createDto.recipientId })
      .andWhere('notification.type = :type', { type: createDto.type })
      .andWhere('notification.fromUserId = :fromUserId', { fromUserId: createDto.fromUserId })
      .andWhere('notification.relatedCommentId = :relatedCommentId', { relatedCommentId: createDto.relatedCommentId })
      .andWhere('notification.createdAt >= :fiveMinutesAgo', { fiveMinutesAgo })
      .getOne();
  }

  
  private async updateExistingNotification(
    existingNotification: Notification,
    createDto: CreateNotificationDto
  ): Promise<NotificationResponseDto> {
    // Update the existing notification with new message and reset read status
    await this.notificationRepository.update(existingNotification.id, {
      message: createDto.message,
      title: createDto.title,
      isRead: false,
      readAt: undefined,
      createdAt: new Date(),
      priority: createDto.priority || existingNotification.priority,
      metadata: { ...existingNotification.metadata, ...createDto.metadata },
    });


    const updatedNotification = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.fromUser', 'fromUser')
      .leftJoinAndSelect('notification.relatedComment', 'relatedComment')
      .where('notification.id = :id', { id: existingNotification.id })
      .getOne();

    return plainToClass(NotificationResponseDto, updatedNotification, {
      excludeExtraneousValues: true,
    });
  }

  
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.recipientId = :userId', { userId })
        .andWhere('notification.isRead = false')
        .getCount();
    } catch (error) {
      this.handleDatabaseError(error, 'getUnreadCount');
    }
  }

  
  async cleanupOldNotifications(): Promise<{ deleted: number }> {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const result = await this.notificationRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :threeMonthsAgo', { threeMonthsAgo })
        .execute();

      return { deleted: result.affected || 0 };
    } catch (error) {
      this.handleDatabaseError(error, 'cleanupOldNotifications');
    }
  }

  
  private handleDatabaseError(error: any, operation: string): never {
    if (error.code === '23503') { // Foreign key violation
      throw new BadRequestException(`Invalid reference in ${operation}`);
    }
    if (error.code === '23505') { // Unique violation
      throw new ConflictException(`Duplicate entry in ${operation}`);
    }
    throw new BadRequestException(`Database error in ${operation}: ${error.message}`);
  }
}
