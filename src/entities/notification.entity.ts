import { User } from './user.entity';
import { Comment } from './comment.entity';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type NotificationType = 'reply' | 'mention' | 'comment_deleted' | 'system';
export type NotificationPriority = 'low' | 'medium' | 'high';

@Entity('notifications')
@Index(['recipientId', 'isRead'])
@Index(['recipientId', 'createdAt'])
@Index(['fromUserId'])
@Index(['relatedCommentId'])
@Index(['type'])
@Index(['priority'])
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    
    @Column({ name: 'recipient_id' })
    recipientId: string;

    @Column({ name: 'from_user_id', nullable: true })
    fromUserId?: string;

    @Column({ name: 'related_comment_id', nullable: true })
    relatedCommentId?: string;

    @Column({ 
        type: 'enum', 
        enum: ['reply', 'mention', 'comment_deleted', 'system'],
        default: 'system'
    })
    type: NotificationType;

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ 
        type: 'enum', 
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    })
    priority: NotificationPriority;

    @Column({ name: 'action_url', nullable: true })
    actionUrl?: string;

    @Column({ type: 'jsonb', default: {} })
    metadata: Record<string, any>;

    @Column({ name: 'is_read', default: false })
    isRead: boolean;

    @Column({ name: 'read_at', nullable: true })
    readAt?: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relations with other entities

    @ManyToOne(() => User, user => user.receivedNotifications)
    @JoinColumn({ name: 'recipient_id' })
    recipient: User;

    @ManyToOne(() => User, user => user.sentNotifications, { nullable: true })
    @JoinColumn({ name: 'from_user_id' })
    fromUser?: User;

    @ManyToOne(() => Comment, comment => comment.notifications, { nullable: true })
    @JoinColumn({ name: 'related_comment_id' })
    relatedComment?: Comment;
}

