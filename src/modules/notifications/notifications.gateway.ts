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
import { corsConfig } from '../../config/cors.config';
import { WebSocketThrottler } from '../../config/websocket-throttler';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

@Injectable()
@WebSocketGateway({
  cors: corsConfig.websocket,
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
    private readonly wsThrottler: WebSocketThrottler,
  ) {
    // Start cleanup task
    setInterval(() => {
      this.wsThrottler.cleanup();
    }, 60000); // Clean up every minute
  }

  afterInit(server: Server) {
    this.logger.log('Notifications WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const clientIp = client.handshake.address;
    
    // Check connection rate limit
    const connectionAllowed = await this.wsThrottler.checkConnectionLimit(clientIp);
    if (!connectionAllowed) {
      client.emit('error', { message: 'Connection rate limit exceeded' });
      client.disconnect();
      return;
    }

    try {
      const token = this.extractTokenFromClient(client);
      
      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      
      // Check user connection limit
      const userConnectionAllowed = await this.wsThrottler.checkUserConnectionLimit(userId);
      if (!userConnectionAllowed) {
        client.emit('error', { message: 'Too many connections for this user' });
        client.disconnect();
        return;
      }

      (client as AuthenticatedSocket).userId = userId;
      (client as AuthenticatedSocket).username = payload.username;
      
      await this.wsThrottler.addConnection(userId);
      this.connectedClients.set(client.id, client as AuthenticatedSocket);
      
      this.logger.log(`Client ${client.id} connected as user ${userId}`);
      
      client.emit('connected', {
        message: 'Connected to notifications',
        userId,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      this.logger.error('Authentication failed:', error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      await this.wsThrottler.removeConnection(client.userId);
    }
    
    this.connectedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  private extractTokenFromClient(client: Socket): string | null {
    const token = client.handshake.auth?.token || 
                  client.handshake.headers?.authorization?.replace('Bearer ', '');
    return token || null;
  }

  private async checkMessageRateLimit(client: AuthenticatedSocket): Promise<boolean> {
    if (!client.userId) {
      return false;
    }

    const allowed = await this.wsThrottler.checkMessageLimit(client.userId);
    if (!allowed) {
      client.emit('error', { message: 'Message rate limit exceeded' });
      return false;
    }

    return true;
  }

  @SubscribeMessage('subscribe-notifications')
  async handleSubscribeNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string }
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!(await this.checkMessageRateLimit(client))) {
      return;
    }

    if (data.userId !== client.userId) {
      client.emit('error', { message: 'Can only subscribe to own notifications' });
      return;
    }

    try {
      const roomName = `notifications_${data.userId}`;
      client.join(roomName);

      client.emit('subscribed', {
        message: 'Subscribed to notifications',
        userId: data.userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`User ${client.userId} subscribed to notifications`);

    } catch (error) {
      this.logger.error(`Error subscribing to notifications:`, error.message);
      client.emit('error', { 
        message: 'Failed to subscribe to notifications',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('unsubscribe-notifications')
  async handleUnsubscribeNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string }
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!(await this.checkMessageRateLimit(client))) {
      return;
    }

    if (data.userId !== client.userId) {
      client.emit('error', { message: 'Can only unsubscribe from own notifications' });
      return;
    }

    try {
      const roomName = `notifications_${data.userId}`;
      client.leave(roomName);

      client.emit('unsubscribed', {
        message: 'Unsubscribed from notifications',
        userId: data.userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`User ${client.userId} unsubscribed from notifications`);

    } catch (error) {
      this.logger.error(`Error unsubscribing from notifications:`, error.message);
      client.emit('error', { 
        message: 'Failed to unsubscribe from notifications',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('mark-notification-read')
  async handleMarkNotificationRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string }
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!(await this.checkMessageRateLimit(client))) {
      return;
    }

    try {
      await this.notificationsService.updateNotification(
        data.notificationId,
        client.userId,
        { isRead: true }
      );

      client.emit('notification-marked-read', {
        notificationId: data.notificationId,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`User ${client.userId} marked notification ${data.notificationId} as read`);

    } catch (error) {
      this.logger.error(`Error marking notification as read:`, error.message);
      client.emit('error', { 
        message: 'Failed to mark notification as read',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('get-unread-count')
  async handleGetUnreadCount(
    @ConnectedSocket() client: AuthenticatedSocket
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!(await this.checkMessageRateLimit(client))) {
      return;
    }

    try {
      const count = await this.notificationsService.getUnreadCount(client.userId);
      
      client.emit('unread-count', {
        count,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Error getting unread count:`, error.message);
      client.emit('error', { 
        message: 'Failed to get unread count',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!(await this.checkMessageRateLimit(client))) {
      return;
    }

    client.emit('pong', { 
      timestamp: new Date().toISOString(),
      userId: client.userId 
    });
  }

  @OnEvent('notification.created')
  async handleNotificationCreated(payload: {
    notification: NotificationResponseDto;
    recipientId: string;
  }) {
    const roomName = `notifications_${payload.recipientId}`;
    
    this.logger.debug(`Broadcasting notification to user ${payload.recipientId}`);
    
    this.server.to(roomName).emit('new-notification', {
      notification: payload.notification,
      timestamp: new Date().toISOString(),
    });

    // Send push notification if user is not connected
    const userConnected = await this.getUserConnectionStatus(payload.recipientId);
    if (!userConnected) {
      this.logger.debug(`User ${payload.recipientId} not connected, could send push notification`);
      // Here you could integrate with push notification service
    }
  }

  @OnEvent('notification.updated')
  async handleNotificationUpdated(payload: {
    notification: NotificationResponseDto;
    recipientId: string;
  }) {
    const roomName = `notifications_${payload.recipientId}`;
    
    this.logger.debug(`Broadcasting notification update to user ${payload.recipientId}`);
    
    this.server.to(roomName).emit('notification-updated', {
      notification: payload.notification,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('notification.deleted')
  async handleNotificationDeleted(payload: {
    notificationId: string;
    recipientId: string;
  }) {
    const roomName = `notifications_${payload.recipientId}`;
    
    this.logger.debug(`Broadcasting notification deletion to user ${payload.recipientId}`);
    
    this.server.to(roomName).emit('notification-deleted', {
      notificationId: payload.notificationId,
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

  getThrottlerStats() {
    return this.wsThrottler.getStats();
  }
} 