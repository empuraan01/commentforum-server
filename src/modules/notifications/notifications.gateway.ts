import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsService } from './notification.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Notifications WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractTokenFromClient(client);
      
      if (!token) {
        this.logger.warn(`Client ${client.id} attempted connection without token`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.userId = payload.sub;
      client.username = payload.username;


      client.join(`user_${client.userId}`);
      
      this.connectedClients.set(client.id, client);

            this.logger.log(`Client ${client.id} connected as user ${client.username} (${client.userId})`);

      
      const unreadCount = await this.notificationsService.getUnreadCount(client.userId!);
      client.emit('unread_count', { count: unreadCount });

    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}:`, error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  private extractTokenFromClient(client: Socket): string | null {
    const token = client.handshake.auth?.token || 
                  client.handshake.headers?.authorization?.replace('Bearer ', '');
    return token || null;
  }

  
  @OnEvent('notification.created')
  async handleNotificationCreated(payload: {
    notification: NotificationResponseDto;
    recipientId: string;
  }) {
    this.logger.debug(`Broadcasting new notification to user ${payload.recipientId}`);
    
    this.server.to(`user_${payload.recipientId}`).emit('notification.new', {
      notification: payload.notification,
      timestamp: new Date().toISOString(),
    });


    const unreadCount = await this.notificationsService.getUnreadCount(payload.recipientId);
    this.server.to(`user_${payload.recipientId}`).emit('unread_count', { 
      count: unreadCount 
    });
  }

  @OnEvent('notification.updated')
  async handleNotificationUpdated(payload: {
    notification: NotificationResponseDto;
    recipientId: string;
  }) {
    this.logger.debug(`Broadcasting notification update to user ${payload.recipientId}`);
    
    this.server.to(`user_${payload.recipientId}`).emit('notification.updated', {
      notification: payload.notification,
      timestamp: new Date().toISOString(),
    });

    const unreadCount = await this.notificationsService.getUnreadCount(payload.recipientId);
    this.server.to(`user_${payload.recipientId}`).emit('unread_count', { 
      count: unreadCount 
    });
  }

  @OnEvent('notification.bulk_updated')
  async handleBulkNotificationUpdate(payload: {
    recipientId: string;
    operation: any;
    affected: number;
  }) {
    this.logger.debug(`Broadcasting bulk update to user ${payload.recipientId}`);
    
    this.server.to(`user_${payload.recipientId}`).emit('notification.bulk_updated', {
      operation: payload.operation,
      affected: payload.affected,
      timestamp: new Date().toISOString(),
    });

    const unreadCount = await this.notificationsService.getUnreadCount(payload.recipientId);
    this.server.to(`user_${payload.recipientId}`).emit('unread_count', { 
      count: unreadCount 
    });
  }

  @OnEvent('notification.deleted')
  async handleNotificationDeleted(payload: {
    notificationId: string;
    recipientId: string;
  }) {
    this.logger.debug(`Broadcasting notification deletion to user ${payload.recipientId}`);
    
    this.server.to(`user_${payload.recipientId}`).emit('notification.deleted', {
      notificationId: payload.notificationId,
      timestamp: new Date().toISOString(),
    });


    const unreadCount = await this.notificationsService.getUnreadCount(payload.recipientId);
    this.server.to(`user_${payload.recipientId}`).emit('unread_count', { 
      count: unreadCount 
    });
  }


  @SubscribeMessage('join_notifications')
  async handleJoinNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId?: string }
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Users can only join their own notification room
    if (data.userId && data.userId !== client.userId) {
      client.emit('error', { message: 'Access denied' });
      return;
    }

    client.join(`user_${client.userId}`);
    
    // Send current unread count
    const unreadCount = await this.notificationsService.getUnreadCount(client.userId!);
    client.emit('unread_count', { count: unreadCount });

    client.emit('joined_notifications', { 
      userId: client.userId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('mark_notification_read')
  async handleMarkNotificationRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string }
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      await this.notificationsService.updateNotification(
        data.notificationId,
        client.userId!,
        { isRead: true }
      );

      client.emit('notification_marked_read', {
        notificationId: data.notificationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      client.emit('error', { 
        message: 'Failed to mark notification as read',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('get_unread_count')
  async handleGetUnreadCount(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const unreadCount = await this.notificationsService.getUnreadCount(client.userId!);
      client.emit('unread_count', { count: unreadCount });
    } catch (error) {
      client.emit('error', { 
        message: 'Failed to get unread count',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { 
      timestamp: new Date().toISOString(),
      userId: client.userId 
    });
  }

  
  async broadcastSystemNotification(notification: NotificationResponseDto) {
    this.logger.log('Broadcasting system notification to all connected clients');
    this.server.emit('system_notification', {
      notification,
      timestamp: new Date().toISOString(),
    });
  }

  async getUserConnectionStatus(userId: string): Promise<boolean> {
    for (const [, client] of this.connectedClients) {
      if (client.userId === userId) {
        return true;
      }
    }
    return false;
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  getConnectedUsersCount(): number {
    const uniqueUsers = new Set<string>();
    for (const [, client] of this.connectedClients) {
      if (client.userId) {
        uniqueUsers.add(client.userId);
      }
    }
    return uniqueUsers.size;
  }
} 