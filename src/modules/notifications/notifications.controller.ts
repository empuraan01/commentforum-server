import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notification.service';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto, BulkUpdateNotificationsDto } from './dto/update-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { PaginatedNotificationsResponseDto } from './dto/paginated-notifications-response.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  
  @Post()
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
    @Request() req: any,
  ): Promise<NotificationResponseDto> {
    try {
      if (createNotificationDto.fromUserId && createNotificationDto.fromUserId !== req.user.sub) {
        throw new HttpException('You can only create notifications as yourself', HttpStatus.FORBIDDEN);
      }

      return await this.notificationsService.createNotification(createNotificationDto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Get()
  async getUserNotifications(
    @Query() query: NotificationQueryDto,
    @Request() req: any,
  ): Promise<PaginatedNotificationsResponseDto> {
    try {
      return await this.notificationsService.getUserNotifications(req.user.sub, query);
    } catch (error) {
      throw new HttpException(
        'Failed to fetch notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Get('unread-count')
  async getUnreadCount(@Request() req: any): Promise<{ count: number }> {
    try {
      const count = await this.notificationsService.getUnreadCount(req.user.sub);
      return { count };
    } catch (error) {
      throw new HttpException(
        'Failed to get unread count',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Get('connection-status')
  async getConnectionStatus(@Request() req: any): Promise<{ connected: boolean }> {
    try {
      const connected = await this.notificationsGateway.getUserConnectionStatus(req.user.sub);
      return { connected };
    } catch (error) {
      throw new HttpException(
        'Failed to get connection status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Put(':id')
  async updateNotification(
    @Param('id') notificationId: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @Request() req: any,
  ): Promise<NotificationResponseDto> {
    try {
      return await this.notificationsService.updateNotification(
        notificationId,
        req.user.sub,
        updateNotificationDto,
      );
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        'Failed to update notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Put(':id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @Request() req: any,
  ): Promise<NotificationResponseDto> {
    try {
      return await this.notificationsService.updateNotification(
        notificationId,
        req.user.sub,
        { isRead: true },
      );
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        'Failed to mark notification as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Put(':id/unread')
  async markAsUnread(
    @Param('id') notificationId: string,
    @Request() req: any,
  ): Promise<NotificationResponseDto> {
    try {
      return await this.notificationsService.updateNotification(
        notificationId,
        req.user.sub,
        { isRead: false },
      );
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        'Failed to mark notification as unread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('bulk')
  async bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdateNotificationsDto,
    @Request() req: any,
  ): Promise<{ affected: number; message: string }> {
    try {
      return await this.notificationsService.bulkUpdateNotifications(
        req.user.sub,
        bulkUpdateDto,
      );
    } catch (error) {
      throw new HttpException(
        'Failed to bulk update notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Put('mark-all-read')
  async markAllAsRead(@Request() req: any): Promise<{ affected: number; message: string }> {
    try {
      return await this.notificationsService.bulkUpdateNotifications(
        req.user.sub,
        { markAllAsRead: true },
      );
    } catch (error) {
      throw new HttpException(
        'Failed to mark all notifications as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteNotification(
    @Param('id') notificationId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    try {
      await this.notificationsService.deleteNotification(notificationId, req.user.sub);
      return { message: 'Notification deleted successfully' };
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Delete('read')
  async deleteAllRead(@Request() req: any): Promise<{ affected: number; message: string }> {
    try {
      return await this.notificationsService.bulkUpdateNotifications(
        req.user.sub,
        { deleteRead: true },
      );
    } catch (error) {
      throw new HttpException(
        'Failed to delete read notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Delete('expired')
  async deleteExpired(@Request() req: any): Promise<{ affected: number; message: string }> {
    try {
      return await this.notificationsService.bulkUpdateNotifications(
        req.user.sub,
        { deleteExpired: true },
      );
    } catch (error) {
      throw new HttpException(
        'Failed to delete expired notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Get('stats')
  async getStats(): Promise<{
    connectedClients: number;
    connectedUsers: number;
  }> {
    try {
      return {
        connectedClients: this.notificationsGateway.getConnectedClientsCount(),
        connectedUsers: this.notificationsGateway.getConnectedUsersCount(),
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get notification stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 