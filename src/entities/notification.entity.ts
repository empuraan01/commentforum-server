import { User } from './user.entity';
import { Comment } from './comment.entity';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';


@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
@Index(['commentId'])
export class Notification{
    @PrimaryGeneratedColumn('uuid')
    id: string;
    
    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'comment_id' })
    commentId: string;

    @Column({ name: 'is_read', default: false })
    isRead: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // relations with the other entities

    @ManyToOne(() => User, user => user.notifications)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Comment, comment => comment.notifications)
    @JoinColumn({ name: 'comment_id' })
    comment: Comment;

}

