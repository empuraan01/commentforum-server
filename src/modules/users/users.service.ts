import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { Comment } from '../../entities/comment.entity';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserCommentsQueryDto } from './dto/user-comments-query.dto';
import { UserProfileResponseDto, PublicUserProfileDto } from './dto/user-profile-response.dto';
import { UserStatsDto } from './dto/users-stats.dto';
import { PaginatedUserCommentsResponseDto, UserCommentsSummaryDto } from './dto/paginated-user-comments-response.dto';
import { CommentResponseDto } from '../comments/dto/comment-response.dto';
import { PaginationMetaDto } from '../comments/dto/pagination-meta.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    private entityManager: EntityManager,
  ) {}

    // cache for user stats like i've implemented for the comments
    private userStatsCache = new Map<string, { data: UserStatsDto; timestamp: number }>();
    private readonly USER_STATS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    async getUserProfile(userId: string): Promise<UserProfileResponseDto>{
        try{
            const user = await this.userRepository
                .createQueryBuilder('user')
                .where('user.id = :userId', { userId })
                .getOne();

            if(!user){
                throw new NotFoundException('User not found');
            }

            return plainToClass(UserProfileResponseDto, user, {
                excludeExtraneousValues: true,
            });
        }
        catch(error){
            if (error instanceof NotFoundException){
                throw error;
            }
            this.handleDatabaseError(error, 'getUserProfile');
        }
    }

    // this is the public user profile, it's used to display the user profile to other users
    // the dto already excludes the private information
    async getPublicUserProfile(userId: string): Promise<PublicUserProfileDto>{
        try{
            const user = await this.userRepository
                .createQueryBuilder('user')
                .where('user.id = :userId', { userId })
                .getOne();
            if(!user){
                throw new NotFoundException('User not found');
            }

            return plainToClass(PublicUserProfileDto, user, {
                excludeExtraneousValues: true,
            });
        }
        catch(error){
            if (error instanceof NotFoundException){
                throw error;
            }
            this.handleDatabaseError(error, 'getPublicUserProfile');
        }
    }

    async updateUserProfile(userId: string, updateDto: UpdateUserProfileDto): Promise<UserProfileResponseDto>{
        try{
            return this.entityManager.transaction(async (transactionalEntityManager) => {
                const existingUser = await transactionalEntityManager.findOne(User, {
                    where: { id: userId },
                });
            if (!existingUser){
                throw new NotFoundException('User not found');
            }

            if (updateDto.username && updateDto.username !== existingUser.username){
                const existingUsername = await transactionalEntityManager.findOne(User, {
                    where: { username: updateDto.username },
                });
                if (existingUsername){
                    throw new ConflictException('Username already exists');
                }
            }
            await transactionalEntityManager
                .createQueryBuilder()
                .update(User)
                .set({
                    username: updateDto.username,
                })
                .where('id = :userId', { userId })
                .execute();
            
            const updatedUser = await transactionalEntityManager.findOne(User, {
                where: { id: userId }
              });

            this.userStatsCache.delete(userId);

            return plainToClass(UserProfileResponseDto, updatedUser, {
                excludeExtraneousValues: true,
              });
        });
        }
        catch(error){
            if (error instanceof NotFoundException){
                throw error;
            }
            this.handleDatabaseError(error, 'updateUserProfile');
        }
    }

    //change password with multiple levels of checks
    async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }>{
        try{
          return this.entityManager.transaction(async (transactionalEntityManager) => {
            const user = await transactionalEntityManager.findOne(User, {
                where: { id: userId },
            });
            if (!user){
                throw new NotFoundException('User not found');
            }
            const isCurrentPasswordValid = await bcrypt.compare(
                changePasswordDto.currentPassword,
                user.passwordHash
            );
            if (!isCurrentPasswordValid){
                throw new UnauthorizedException('Invalid current password');
            }
            
            if(changePasswordDto.newPassword !== changePasswordDto.confirmPassword){
                throw new BadRequestException('Passwords do not match');
            }

            const isSamePassword = await bcrypt.compare(
                changePasswordDto.newPassword,
                user.passwordHash
            );
            if (isSamePassword){
                throw new BadRequestException('New password cannot be the same as the current password');
            }

            const saltRounds = 12;
            const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

            await transactionalEntityManager
                .createQueryBuilder()
                .update(User)
                .set({
                    passwordHash: newPasswordHash,
                })
                .where('id = :userId', { userId })
                .execute();

            return { message: 'Password changed successfully' };
          })
        } catch(error){
            if (error instanceof NotFoundException ||
                error instanceof UnauthorizedException ||
                error instanceof BadRequestException
            ){
                throw error;
            }
            this.handleDatabaseError(error, 'changePassword');
        }
    }


    //endpoint to get the user stats

  async getUserStats(userId: string): Promise<UserStatsDto> {
    try {
      // Check cache first
      const cached = this.userStatsCache.get(userId);
      if (cached && (Date.now() - cached.timestamp) < this.USER_STATS_CACHE_TTL) {
        return cached.data;
      }

      // Complex stats query using raw SQL for performance
      const statsQuery = await this.entityManager.query(`
        WITH user_comment_stats AS (
          SELECT 
            COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as total_comments,
            COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as total_replies,
            MIN(created_at) as first_comment_at,
            MAX(created_at) as last_comment_at,
            DATE_TRUNC('day', created_at) as comment_date,
            COUNT(*) as daily_count
          FROM comments 
          WHERE user_id = $1 AND is_deleted = false
          GROUP BY DATE_TRUNC('day', created_at)
        ),
        most_active_day AS (
          SELECT comment_date, daily_count
          FROM user_comment_stats
          ORDER BY daily_count DESC
          LIMIT 1
        ),
        top_comment AS (
          SELECT id, total_replies
          FROM comments
          WHERE user_id = $1 AND is_deleted = false AND parent_id IS NULL
          ORDER BY total_replies DESC
          LIMIT 1
        ),
        activity_metrics AS (
          SELECT 
            CASE 
              WHEN MAX(created_at) IS NOT NULL 
              THEN EXTRACT(days FROM NOW() - MAX(created_at))
              ELSE NULL 
            END as days_since_last_activity,
            CASE 
              WHEN COUNT(CASE WHEN parent_id IS NULL THEN 1 END) > 0
              THEN COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END)::float / 
                   COUNT(CASE WHEN parent_id IS NULL THEN 1 END)::float
              ELSE 0 
            END as average_replies_per_comment
          FROM comments
          WHERE user_id = $1 AND is_deleted = false
        )
        SELECT 
          (SELECT SUM(total_comments) FROM user_comment_stats) as total_comments,
          (SELECT SUM(total_replies) FROM user_comment_stats) as total_replies,
          (SELECT MIN(first_comment_at) FROM user_comment_stats) as first_comment_at,
          (SELECT MAX(last_comment_at) FROM user_comment_stats) as last_comment_at,
          (SELECT comment_date FROM most_active_day) as most_active_day,
          (SELECT id FROM top_comment) as top_comment_id,
          (SELECT days_since_last_activity FROM activity_metrics) as days_since_last_activity,
          (SELECT average_replies_per_comment FROM activity_metrics) as average_replies_per_comment;
      `, [userId]);

      const stats = statsQuery[0];
      
      const userStats = plainToClass(UserStatsDto, {
        totalComments: parseInt(stats.total_comments) || 0,
        totalReplies: parseInt(stats.total_replies) || 0,
        firstCommentAt: stats.first_comment_at,
        lastCommentAt: stats.last_comment_at,
        mostActiveDay: stats.most_active_day,
        topCommentId: stats.top_comment_id,
        daysSinceLastActivity: parseInt(stats.days_since_last_activity) || 0,
        averageRepliesPerComment: parseFloat(stats.average_replies_per_comment) || 0,
      });

      // cache the result
      this.userStatsCache.set(userId, {
        data: userStats,
        timestamp: Date.now()
      });

      return userStats;
    } catch (error) {
      this.handleDatabaseError(error, 'getUserStats');
    }
  }

  // endpoint to get the user comments

  async getUserComments(userId: string, query: UserCommentsQueryDto): Promise<PaginatedUserCommentsResponseDto> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const offset = (page - 1) * limit;

      // build dynamic query based on filters
      let queryBuilder = this.commentRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.user', 'user')
        .leftJoinAndSelect('comment.parent', 'parent')
        .leftJoinAndSelect('parent.user', 'parentUser')
        .where('comment.userId = :userId', { userId });

      // apply filters
      if (!query.includeDeleted) {
        queryBuilder.andWhere('comment.isDeleted = false');
      }

      if (query.topLevelOnly) {
        queryBuilder.andWhere('comment.parentId IS NULL');
      }

      if (query.fromDate) {
        queryBuilder.andWhere('comment.createdAt >= :fromDate', { fromDate: query.fromDate });
      }

      if (query.toDate) {
        queryBuilder.andWhere('comment.createdAt <= :toDate', { toDate: query.toDate });
      }

      if (query.minReplies !== undefined) {
        queryBuilder.andWhere('comment.totalReplies >= :minReplies', { minReplies: query.minReplies });
      }

      // apply sorting
      switch (query.sortBy) {
        case 'oldest':
          queryBuilder.orderBy('comment.createdAt', 'ASC');
          break;
        case 'most_replies':
          queryBuilder.orderBy('comment.totalReplies', 'DESC');
          break;
        case 'newest':
        default:
          queryBuilder.orderBy('comment.createdAt', 'DESC');
          break;
      }

      // execute queries in parallel
      const [comments, totalItems, summaryData] = await Promise.all([
        queryBuilder
          .skip(offset)
          .take(limit)
          .getMany(),
        queryBuilder.getCount(),
        this.getUserCommentsSummary(userId, query)
      ]);


      const commentDtos = comments.map(comment => 
        plainToClass(CommentResponseDto, comment, { excludeExtraneousValues: true })
      );

      // calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const meta = plainToClass(PaginationMetaDto, {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      });

      return plainToClass(PaginatedUserCommentsResponseDto, {
        data: commentDtos,
        meta,
        summary: summaryData,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'getUserComments');
    }
  }

  private async getUserCommentsSummary(userId: string, query: UserCommentsQueryDto): Promise<UserCommentsSummaryDto> {
    // build summary query with same filters as main query
    let summaryQueryBuilder = this.commentRepository
      .createQueryBuilder('comment')
      .where('comment.userId = :userId', { userId });

    // apply same filters as main query
    if (!query.includeDeleted) {
      summaryQueryBuilder.andWhere('comment.isDeleted = false');
    }

    if (query.topLevelOnly) {
      summaryQueryBuilder.andWhere('comment.parentId IS NULL');
    }

    if (query.fromDate) {
      summaryQueryBuilder.andWhere('comment.createdAt >= :fromDate', { fromDate: query.fromDate });
    }

    if (query.toDate) {
      summaryQueryBuilder.andWhere('comment.createdAt <= :toDate', { toDate: query.toDate });
    }

    if (query.minReplies !== undefined) {
      summaryQueryBuilder.andWhere('comment.totalReplies >= :minReplies', { minReplies: query.minReplies });
    }

    // get summary statistics
    const summaryResult = await summaryQueryBuilder
      .select([
        'COUNT(CASE WHEN comment.parentId IS NULL THEN 1 END) as totalComments',
        'COUNT(CASE WHEN comment.parentId IS NOT NULL THEN 1 END) as totalReplies',
        'COUNT(CASE WHEN comment.isDeleted = true THEN 1 END) as deletedComments',
        'AVG(comment.totalReplies) as averageRepliesPerComment',
        'MIN(comment.createdAt) as earliest',
        'MAX(comment.createdAt) as latest',
      ])
      .getRawOne();

    return plainToClass(UserCommentsSummaryDto, {
      totalComments: parseInt(summaryResult.totalComments) || 0,
      totalReplies: parseInt(summaryResult.totalReplies) || 0,
      deletedComments: parseInt(summaryResult.deletedComments) || 0,
      averageRepliesPerComment: parseFloat(summaryResult.averageRepliesPerComment) || 0,
      dateRange: {
        earliest: summaryResult.earliest,
        latest: summaryResult.latest,
      },
    });
  }

  // endpoint to delete the user account

  async deleteUserAccount(userId: string): Promise<void> {
    try {
      return this.entityManager.transaction(async (transactionalEntityManager) => {
        const user = await transactionalEntityManager.findOne(User, {
          where: { id: userId }
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        // soft delete user account - anonymize data
        await transactionalEntityManager
          .createQueryBuilder()
          .update(User)
          .set({
            username: `deleted_user_${userId.substring(0, 8)}`,
            passwordHash: 'DELETED',
            updatedAt: new Date(),
          })
          .where('id = :userId', { userId })
          .execute();


        await transactionalEntityManager
          .createQueryBuilder()
          .update(Comment)
          .set({
            isDeleted: true,
            text: '[deleted by user]',
            updatedAt: new Date(),
          })
          .where('userId = :userId', { userId })
          .execute();


        this.userStatsCache.delete(userId);
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.handleDatabaseError(error, 'deleteUserAccount');
    }
  }


  private handleDatabaseError(error: any, operation: string): never {
    if (error.code === '23503') { // Foreign key violation
      throw new BadRequestException(`Invalid reference in ${operation}`);
    }
    if (error.code === '23505') { // Unique violation
      throw new ConflictException(`Duplicate entry in ${operation}`);
    }
    throw new BadRequestException(`Database error in ${operation}: ${error.message}`);
  }
}
