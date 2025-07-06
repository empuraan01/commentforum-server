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
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { commentsService } from './comments.service';
import { ThreadJoinDto } from './dto/thread-join.dto';
import { ThreadLeaveDto } from './dto/thread-leave.dto';
import { CommentResponseDto } from './dto/comment-response.dto';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

interface ThreadRoom {
  threadId: string;
  userCount: number;
  users: Set<string>;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/ws/comments',
})
export class CommentThreadsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CommentThreadsGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();
  private threadRooms = new Map<string, ThreadRoom>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly commentsService: commentsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Comment Threads WebSocket Gateway initialized');
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

      this.connectedClients.set(client.id, client);

      this.logger.log(
        `Client ${client.id} connected as user ${client.username} (${client.userId})`
      );

      client.emit('connected', {
        message: 'Connected to comment threads',
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(
        `Authentication failed for client ${client.id}:`,
        error.message
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.leaveAllThreads(client);
    
    this.connectedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  private extractTokenFromClient(client: Socket): string | null {
    const token = client.handshake.auth?.token || 
                  client.handshake.headers?.authorization?.replace('Bearer ', '');
    return token || null;
  }

  @SubscribeMessage('join-thread')
  async handleJoinThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ThreadJoinDto
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const thread = await this.commentsService.findCommentById(data.threadId);
      if (!thread) {
        client.emit('error', { message: 'Thread not found' });
        return;
      }

      const roomName = `thread_${data.threadId}`;
      client.join(roomName);

      this.updateThreadRoom(data.threadId, client.userId, 'join');

      const threadRoom = this.threadRooms.get(data.threadId);
      const userCount = threadRoom?.userCount || 0;

      this.logger.debug(
        `User ${client.userId} joined thread ${data.threadId} (${userCount} users viewing)`
      );

      client.emit('thread-joined', {
        threadId: data.threadId,
        userCount,
        timestamp: new Date().toISOString(),
      });

      client.to(roomName).emit('thread-user-joined', {
        threadId: data.threadId,
        userCount,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Error joining thread ${data.threadId}:`, error.message);
      client.emit('error', { 
        message: 'Failed to join thread',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('leave-thread')
  async handleLeaveThread(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ThreadLeaveDto
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const roomName = `thread_${data.threadId}`;
      client.leave(roomName);

      this.updateThreadRoom(data.threadId, client.userId, 'leave');

      const threadRoom = this.threadRooms.get(data.threadId);
      const userCount = threadRoom?.userCount || 0;

      this.logger.debug(
        `User ${client.userId} left thread ${data.threadId} (${userCount} users viewing)`
      );

      client.emit('thread-left', {
        threadId: data.threadId,
        userCount,
        timestamp: new Date().toISOString(),
      });

      client.to(roomName).emit('thread-user-left', {
        threadId: data.threadId,
        userCount,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Error leaving thread ${data.threadId}:`, error.message);
      client.emit('error', { 
        message: 'Failed to leave thread',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('get-thread-stats')
  async handleGetThreadStats(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { threadId: string }
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const threadRoom = this.threadRooms.get(data.threadId);
    client.emit('thread-stats', {
      threadId: data.threadId,
      userCount: threadRoom?.userCount || 0,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', {
      timestamp: new Date().toISOString(),
      userId: client.userId,
    });
  }

  @OnEvent('comment.created')
  async handleNewReply(payload: {
    comment: CommentResponseDto;
    parentId?: string;
  }) {
    if (payload.parentId) {
      const roomName = `thread_${payload.parentId}`;
      
      this.logger.debug(`Broadcasting new reply to thread ${payload.parentId}`);
      
      this.server.to(roomName).emit('new-reply', {
        reply: payload.comment,
        threadId: payload.parentId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @OnEvent('comment.reply_count_updated')
  async handleReplyCountUpdated(payload: {
    commentId: string;
    replyCount: number;
    totalReplies: number;
  }) {
    const roomName = `thread_${payload.commentId}`;
    
    this.logger.debug(`Broadcasting reply count update for thread ${payload.commentId}`);
    
    this.server.to(roomName).emit('reply-count-updated', {
      commentId: payload.commentId,
      count: payload.replyCount,
      totalReplies: payload.totalReplies,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('comment.updated')
  async handleCommentEdited(payload: {
    comment: CommentResponseDto;
  }) {
    let roomName = `thread_${payload.comment.id}`;
    this.server.to(roomName).emit('comment-edited', {
      id: payload.comment.id,
      updatedText: payload.comment.text,
      updatedAt: payload.comment.updatedAt,
      timestamp: new Date().toISOString(),
    });

    if (payload.comment.parent?.id) {
      roomName = `thread_${payload.comment.parent.id}`;
      this.server.to(roomName).emit('comment-edited', {
        id: payload.comment.id,
        updatedText: payload.comment.text,
        updatedAt: payload.comment.updatedAt,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @OnEvent('comment.deleted')
  async handleCommentDeleted(payload: {
    commentId: string;
    parentId?: string;
  }) {
    let roomName = `thread_${payload.commentId}`;
    this.server.to(roomName).emit('comment-deleted', {
      id: payload.commentId,
      timestamp: new Date().toISOString(),
    });

    if (payload.parentId) {
      roomName = `thread_${payload.parentId}`;
      this.server.to(roomName).emit('comment-deleted', {
        id: payload.commentId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private updateThreadRoom(threadId: string, userId: string, action: 'join' | 'leave') {
    let threadRoom = this.threadRooms.get(threadId);
    
    if (!threadRoom) {
      threadRoom = {
        threadId,
        userCount: 0,
        users: new Set(),
      };
      this.threadRooms.set(threadId, threadRoom);
    }

    if (action === 'join') {
      threadRoom.users.add(userId);
    } else {
      threadRoom.users.delete(userId);
    }

    threadRoom.userCount = threadRoom.users.size;

    if (threadRoom.userCount === 0) {
      this.threadRooms.delete(threadId);
    }
  }

  private leaveAllThreads(client: AuthenticatedSocket) {
    if (!client.userId) return;

    for (const [threadId, threadRoom] of this.threadRooms) {
      if (threadRoom.users.has(client.userId)) {
        this.updateThreadRoom(threadId, client.userId, 'leave');
        
        const roomName = `thread_${threadId}`;
        client.to(roomName).emit('thread-user-left', {
          threadId,
          userCount: threadRoom.userCount,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  async getThreadUserCount(threadId: string): Promise<number> {
    const threadRoom = this.threadRooms.get(threadId);
    return threadRoom?.userCount || 0;
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  getActiveThreadsCount(): number {
    return this.threadRooms.size;
  }

  getTotalThreadViewers(): number {
    return Array.from(this.threadRooms.values())
      .reduce((total, room) => total + room.userCount, 0);
  }
}
