import { Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    CreateDateColumn, 
    UpdateDateColumn, 
    OneToMany, 
    Index } from 'typeorm';

// I'm importing the other entities that the user entity will have a relationship with
import { Comment } from './comment.entity';
import { Notification } from './notification.entity';

@Entity('users')
@Index(['username']) 
@Index(['createdAt']) 
export class User{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // using username password auth, so cant have a nullable username and has to be unique as well

    @Column({ unique: true, length: 50, nullable: false }) 
    username: string;

    @Column({ name: 'password_hash', nullable: false, length: 255 })
    passwordHash: string;

    @Column({ name: 'comment_count', default: 0 })
    commentCount: number;

    @Column({ name: 'reply_count', default: 0 })
    replyCount: number;

    @CreateDateColumn({name: 'created_at'})
    createdAt: Date;

    @UpdateDateColumn({name: 'updated_at'})
    updatedAt: Date;

    // so I'm defining the relationship that the user entity has with the other entities

    @OneToMany(() => Comment, comment => comment.user)
    comments: Comment[];

    @OneToMany(() => Notification, notification => notification.user)
    notifications: Notification[];
    
}