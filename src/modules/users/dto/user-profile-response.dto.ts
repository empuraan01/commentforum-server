import { Expose, Transform, Type, Exclude } from 'class-transformer';

export class UserProfileResponseDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  commentCount: number;

  @Expose()
  replyCount: number;

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  @Expose()
  @Transform(({ obj }) => {
    const now = new Date();
    const created = new Date(obj.createdAt);
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  })
  daysSinceJoined: number;

  @Exclude()
  passwordHash?: string;

  @Exclude() 
  email?: string;
}

// this is the dto for the public user profile, have omitted the private information
export class PublicUserProfileDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  commentCount: number;

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Transform(({ obj }) => {
    const now = new Date();
    const created = new Date(obj.createdAt);
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  })
  daysSinceJoined: number;

  // exclude private information for public profiles
  @Exclude()
  replyCount?: number;

  @Exclude()
  updatedAt?: Date;

  @Exclude()
  passwordHash?: string;
}
