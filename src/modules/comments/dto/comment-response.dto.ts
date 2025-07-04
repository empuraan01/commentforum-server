import { Expose, Transform, Type, Exclude } from 'class-transformer';

export class CommentResponseDto {
    @Expose() //expose decorator is used to specify that the property should be exposed in the response
    id: string;

    @Expose()
    @Transform(({ obj }) => obj.isDeleted ? '[deleted]' : obj.text)
    text: string;

    @Expose()
    @Type(() => Date)
    createdAt: Date;

    @Expose()
    @Type(() => Date)
    updatedAt: Date;

    @Expose()
    isDeleted: boolean;

    @Expose()
    replyCount: number;

    @Expose()
    totalReplies: number;

    @Expose()
    @Type(() => Date)
    @Transform(({ value }) => value || null)
    lastReplyAt: Date | null;

    @Expose()
    @Type(() => UserResponseDto)
    @Transform(({ obj }) => obj.isDeleted ? null : obj.user)
    user: UserResponseDto | null;

    @Expose()
    @Type(() => ParentCommentDto)
    @Transform(({ obj }) => obj.parent ? {
        id: obj.parent.id,
        text: obj.parent.text?.length > 100 
            ? obj.parent.text.substring(0, 100) + '...'
            : obj.parent.text,
        user: {
            id: obj.parent.user.id,
            username: obj.parent.user.username,
        },
        createdAt: obj.parent.createdAt,
    } : undefined)
    parent?: ParentCommentDto;

    @Expose()
    @Type(() => CommentResponseDto)
    @Transform(({ value }) => value || [])
    replies: CommentResponseDto[];
}

// this represents the user who made the comment
export class UserResponseDto {
    @Expose()
    id: string;

    @Expose()
    username: string;

    @Expose()
    commentCount: number;

    // this is to exclude sensitive data that might be loaded
    @Exclude()
    passwordHash?: string;

    @Exclude()
    email?: string;
}

export class ParentCommentDto {
    @Expose()
    id: string;

    @Expose()
    text: string;

    @Expose()
    @Type(() => ParentUserDto)
    user: ParentUserDto;

    @Expose()
    @Type(() => Date)
    createdAt: Date;
}

export class ParentUserDto {
    @Expose()
    id: string;

    @Expose()
    username: string;
}