import { 
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index 
} from 'typeorm';
import { User } from './user.entity';
import { Notification } from './notification.entity';

/* I'm indexing the properties in this entity so that the queries are faster. These 
are essentially performance caches. The reads are faster but the writes are usually slower.*/

@Entity('comments')
@Index(['userId', 'createdAt']) 
@Index(['parentId', 'createdAt']) 
@Index(['createdAt']) 
@Index(['isDeleted', 'parentId']) 
export class Comment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'parent_id', nullable: true })
    parentId: string | null;

    @Column({ type: 'text' })
    text: string;

    // this is so that I can still see the comment that I deleted and not have to delete it from the database
    @Column({ name: 'is_deleted', default: false })
    isDeleted: boolean;

    @Column({ name: 'reply_count', default: 0 })
    replyCount: number;

    @Column({ name: 'total_replies', default: 0 })
    totalReplies: number; 

    @Column({ name: 'last_reply_at', type: 'timestamp', nullable: true })
    lastReplyAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Now the relaitons with the other entities

    @ManyToOne(() => User, user => user.comments)
    @JoinColumn({ name: 'user_id' })
    user: User; //this is the foreign key kind of thing

    // this is the relationship with the parent comment (many comments can have one parent)

    @ManyToOne(() => Comment, comment => comment.replies, { nullable: true })
    @JoinColumn({ name: 'parent_id' })
    parent: Comment | null;

    // this is the relationship with the replies (one comment can have many replies)
    @OneToMany(() => Comment, comment => comment.parent)
    replies: Comment[];

    // this is the relationship with the notifications (one comment can have many notifications)
    @OneToMany(() => Notification, notification => notification.relatedComment)
    notifications: Notification[];
}