import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager} from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Comment } from '../../entities/comment.entity';
import { User } from '../../entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { PaginatedCommentsResponseDto } from './dto/paginated-comments-response.dto';
import { CommentStatsDto } from './dto/comments-stats.dto';
import { PaginationMetaDto } from './dto/pagination-meta.dto';
import { plainToClass } from 'class-transformer';
import { ReplyQueryDto } from './dto/reply-query.dto';

// since performance is of the essence here iam going to use raw sql more instead of the ORM

@Injectable()
export class commentsService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private entityManager: EntityManager,
    private eventEmitter: EventEmitter2,
  ) {}

  private statsCache: { data: CommentStatsDto; timestamp: number } | null = null;
  private readonly STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async createComment(createCommentDto: CreateCommentDto, userId: string): Promise<CommentResponseDto> {
    try {
    return this.entityManager.transaction(async (transactionalEntityManager) => {
      // iam cheching if the user even exists first
      const user = await transactionalEntityManager.findOne(User, { 
        where: { id: userId } 
      });
      
      if (!user) {
        throw new NotFoundException('User not found');
      }

        let parentComment: Comment | null = null;

      // we are checking if the user is replying to a comment
      if (createCommentDto.parentId) {
        parentComment = await transactionalEntityManager
          .createQueryBuilder(Comment, 'comment')
          .leftJoinAndSelect('comment.user', 'user')
          .where('comment.id = :parentId', { parentId: createCommentDto.parentId })
          .andWhere('comment.isDeleted = false')
          .getOne();

          if (!parentComment) {
            throw new NotFoundException('Parent comment not found or deleted');
          }
        }

        // Create the comment
        const comment = transactionalEntityManager.create(Comment, {
          text: createCommentDto.text,
          userId,
          parentId: createCommentDto.parentId || null,
        });

        const savedComment = await transactionalEntityManager.save(comment);

      // updating the reply counts for the parent comment and the total replies as well
      if (parentComment) {
        await transactionalEntityManager
          .createQueryBuilder()
          .update(Comment)
          .set({
            replyCount: () => 'reply_count + 1',
            totalReplies: () => 'total_replies + 1',
            lastReplyAt: new Date(),
          })
          .where('id = :parentId', { parentId: createCommentDto.parentId })
          .execute();

        // updating the total reply counts for all the ancestor comments
        await transactionalEntityManager.query(`
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_id
            FROM comments 
            WHERE id = $1
            
            UNION ALL
            
            SELECT c.id, c.parent_id
            FROM comments c
            INNER JOIN ancestors a ON c.id = a.parent_id
          )
          UPDATE comments 
          SET total_replies = total_replies + 1 
          WHERE id IN (SELECT id FROM ancestors WHERE id != $1);
        `, [createCommentDto.parentId]);
      }

      // updating the comment count for the user
      await transactionalEntityManager
        .createQueryBuilder()
        .update(User)
        .set({ commentCount: () => 'comment_count + 1' })
        .where('id = :userId', { userId })
        .execute();

      // fetching the complete comment with relationships for response
      const completeComment = await transactionalEntityManager
        .createQueryBuilder(Comment, 'comment')
        .leftJoinAndSelect('comment.user', 'user')
        .leftJoinAndSelect('comment.parent', 'parent')
        .leftJoinAndSelect('parent.user', 'parentUser')
        .where('comment.id = :id', { id: savedComment.id })
        .getOne();

        // Invalidate cache since stats changed
        this.statsCache = null;

        const result = plainToClass(CommentResponseDto, completeComment, {
          excludeExtraneousValues: true,
        });


        this.eventEmitter.emit('comment.created', {
          comment: result,
          parentId: createCommentDto.parentId,
        });


        if (createCommentDto.parentId && parentComment) {
          this.eventEmitter.emit('comment.reply_count_updated', {
            commentId: createCommentDto.parentId,
            replyCount: parentComment.replyCount + 1,
            totalReplies: parentComment.totalReplies + 1,
          });
        }

        return result;
        });
    } catch (error) {
      // Handle known business logic errors
      if (error instanceof NotFoundException || 
          error instanceof UnauthorizedException || 
          error instanceof BadRequestException) {
        throw error;
      }
      // Handle database errors
      this.handleDatabaseError(error, 'createComment');
    }
  }

  async findAllComments(query: CommentQueryDto): Promise<PaginatedCommentsResponseDto> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const offset = (page - 1) * limit;


    const queryBuilder = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .leftJoinAndSelect('comment.parent', 'parent')
      .leftJoinAndSelect('parent.user', 'parentUser')
      .where('comment.parentId IS NULL') 
      .andWhere('comment.isDeleted = false');

    // applying filters
    if (query.userId) {
      queryBuilder.andWhere('comment.userId = :userId', { userId: query.userId });
    }

    // sorting the comments based on recent or old 
    const sortOrder = query.sortBy === 'oldest' ? 'ASC' : 'DESC';
    queryBuilder.orderBy('comment.createdAt', sortOrder);


    const [comments, totalItems] = await Promise.all([
      queryBuilder
        .skip(offset)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);


    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await this.loadRepliesRecursively(comment.id, { limit: 3 });
        return { ...comment, replies };
      })
    );


    const commentDtos = commentsWithReplies.map(comment => 
      plainToClass(CommentResponseDto, comment, { excludeExtraneousValues: true })
    );


    const totalPages = Math.ceil(totalItems / limit);
    const meta = plainToClass(PaginationMetaDto, {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });

      return plainToClass(PaginatedCommentsResponseDto, {
        data: commentDtos,
        meta,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'findAllComments');
    }
  }

  private async loadRepliesRecursively(
    commentId: string, 
    options: { limit?: number; offset?: number } = {}
  ): Promise<Comment[]> {
    const { limit = 50, offset = 0 } = options;


    const replies = await this.entityManager.query(`
      WITH RECURSIVE comment_tree AS (
        -- Base case: direct replies to the comment
        SELECT 
          c.id, c.user_id, c.parent_id, c.text, c.is_deleted,
          c.reply_count, c.total_replies, c.last_reply_at,
          c.created_at, c.updated_at,
          u.username, u.comment_count,
          1 as tree_depth,
          c.created_at as sort_key
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.parent_id = $1 AND c.is_deleted = false
        
        UNION ALL
        
        -- Recursive case: replies to replies
        SELECT 
          c.id, c.user_id, c.parent_id, c.text, c.is_deleted,
          c.reply_count, c.total_replies, c.last_reply_at,
          c.created_at, c.updated_at,
          u.username, u.comment_count,
          ct.tree_depth + 1 as tree_depth,
          c.created_at as sort_key
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        INNER JOIN comment_tree ct ON c.parent_id = ct.id
        WHERE c.is_deleted = false
      )
      SELECT * FROM comment_tree
      ORDER BY tree_depth, sort_key
      LIMIT $2 OFFSET $3;
    `, [commentId, limit, offset]);


    return replies.map(row => {
      const comment = new Comment();
      comment.id = row.id;
      comment.userId = row.user_id;
      comment.parentId = row.parent_id;
      comment.text = row.text;
      comment.isDeleted = row.is_deleted;
      comment.replyCount = row.reply_count;
      comment.totalReplies = row.total_replies;
      comment.lastReplyAt = row.last_reply_at;
      comment.createdAt = row.created_at;
      comment.updatedAt = row.updated_at;

      comment.user = {
        id: row.user_id,
        username: row.username,
        commentCount: row.comment_count,
      } as User;

      return comment;
    });
  }

  async updateComment(
    id: string, 
    updateCommentDto: UpdateCommentDto, 
    userId: string
  ): Promise<CommentResponseDto> {
    try {
      const comment = await this.commentRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.user', 'user')
        .where('comment.id = :id', { id })
        .getOne();

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new UnauthorizedException('You can only update your own comments');
    }

    if (comment.isDeleted) {
      throw new BadRequestException('Cannot update deleted comment');
    }

      await this.commentRepository
        .createQueryBuilder()
        .update(Comment)
        .set({ 
          text: updateCommentDto.text,
          updatedAt: new Date(),
        })
        .where('id = :id', { id })
        .execute();

      const updatedComment = await this.commentRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.user', 'user')
        .leftJoinAndSelect('comment.parent', 'parent')
        .leftJoinAndSelect('parent.user', 'parentUser')
        .where('comment.id = :id', { id })
        .getOne();

      const result = plainToClass(CommentResponseDto, updatedComment, {
        excludeExtraneousValues: true,
      });


      this.eventEmitter.emit('comment.updated', {
        comment: result,
      });

      return result;
    } catch (error) {

      if (error instanceof NotFoundException || 
          error instanceof UnauthorizedException || 
          error instanceof BadRequestException) {
        throw error;
      }

      this.handleDatabaseError(error, 'updateComment');
    }
  }

  async deleteComment(id: string, userId: string): Promise<void> {
    try {
      return this.entityManager.transaction(async (transactionalEntityManager) => {
        // checking if the comment exists and if the user is the owner of the comment 
        const comment = await transactionalEntityManager
          .createQueryBuilder(Comment, 'comment')
          .where('comment.id = :id', { id })
          .getOne();

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      if (comment.userId !== userId) {
        throw new UnauthorizedException('You can only delete your own comments');
      }

      if (comment.isDeleted) {
        throw new BadRequestException('Comment already deleted');
      }

      // Soft delete the comment
      await transactionalEntityManager
        .createQueryBuilder()
        .update(Comment)
        .set({ 
          isDeleted: true,
          updatedAt: new Date(),
        })
        .where('id = :id', { id })
        .execute();


      if (comment.parentId) {
        await transactionalEntityManager
          .createQueryBuilder()
          .update(Comment)
          .set({
            replyCount: () => 'reply_count - 1',
            totalReplies: () => 'total_replies - 1',
          })
          .where('id = :parentId', { parentId: comment.parentId })
          .execute();


        await transactionalEntityManager.query(`
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_id
            FROM comments 
            WHERE id = $1
            
            UNION ALL
            
            SELECT c.id, c.parent_id
            FROM comments c
            INNER JOIN ancestors a ON c.id = a.parent_id
          )
          UPDATE comments 
          SET total_replies = total_replies - 1 
          WHERE id IN (SELECT id FROM ancestors WHERE id != $1);
        `, [comment.parentId]);
      }


        await transactionalEntityManager
          .createQueryBuilder()
          .update(User)
          .set({ commentCount: () => 'comment_count - 1' })
          .where('id = :userId', { userId })
          .execute();


        this.statsCache = null;


        this.eventEmitter.emit('comment.deleted', {
          commentId: id,
          parentId: comment.parentId,
        });


        if (comment.parentId) {
          this.eventEmitter.emit('comment.reply_count_updated', {
            commentId: comment.parentId,
            replyCount: Math.max(0, comment.replyCount - 1),
            totalReplies: Math.max(0, comment.totalReplies - 1),
          });
        }
      });
    } catch (error) {

      if (error instanceof NotFoundException || 
          error instanceof UnauthorizedException || 
          error instanceof BadRequestException) {
        throw error;
      }

      this.handleDatabaseError(error, 'deleteComment');
    }
  }


  // iam using a cache here to avoid the overhead of querying the database every time
  // the cache is valid for 5 minutes
  async getCommentStats(): Promise<CommentStatsDto> {
    try {
      // checking if the cache is still valid
      if (this.statsCache && 
          (Date.now() - this.statsCache.timestamp) < this.STATS_CACHE_TTL) {
        return this.statsCache.data;
      }

      const statsQuery = await this.entityManager.query(`
        WITH comment_stats AS (
          SELECT 
            COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as total_comments,
            COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as total_replies,
            DATE_TRUNC('day', created_at) as comment_date,
            COUNT(*) as daily_count
          FROM comments 
          WHERE is_deleted = false
          GROUP BY DATE_TRUNC('day', created_at)
        ),
        most_active_day AS (
          SELECT comment_date, daily_count
          FROM comment_stats
          ORDER BY daily_count DESC
          LIMIT 1
        ),
        top_comment AS (
          SELECT id, total_replies
          FROM comments
          WHERE is_deleted = false AND parent_id IS NULL
          ORDER BY total_replies DESC
          LIMIT 1
        ),
        last_comment AS (
          SELECT created_at
          FROM comments
          WHERE is_deleted = false
          ORDER BY created_at DESC
          LIMIT 1
        )
        SELECT 
          (SELECT SUM(total_comments) FROM comment_stats) as total_comments,
          (SELECT SUM(total_replies) FROM comment_stats) as total_replies,
          (SELECT comment_date FROM most_active_day) as most_active_day,
          (SELECT COALESCE(AVG(daily_count), 0) FROM comment_stats) as average_comments_per_day,
          (SELECT id FROM top_comment) as top_comment_id,
          (SELECT created_at FROM last_comment) as last_comment_at;
      `);

      const stats = statsQuery[0];
      
      const result = plainToClass(CommentStatsDto, {
        totalComments: parseInt(stats.total_comments) || 0,
        totalReplies: parseInt(stats.total_replies) || 0,
        mostActiveDay: stats.most_active_day,
        averageCommentsPerDay: parseFloat(stats.average_comments_per_day) || 0,
        topCommentId: stats.top_comment_id,
        lastCommentAt: stats.last_comment_at,
      });


      this.statsCache = {
        data: result,
        timestamp: Date.now()
      };

      return result;
    } catch (error) {
      this.handleDatabaseError(error, 'getCommentStats');
    }
  }

  async findCommentById(id: string): Promise<CommentResponseDto> {
    try {
      const comment = await this.commentRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.user', 'user')
        .leftJoinAndSelect('comment.parent', 'parent')
        .leftJoinAndSelect('parent.user', 'parentUser')
        .where('comment.id = :id', { id })
        .andWhere('comment.isDeleted = false')
        .getOne();

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

      return plainToClass(CommentResponseDto, comment, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.handleDatabaseError(error, 'findCommentById');
    }
  }

  async findReplies(commentId: string, query: ReplyQueryDto): Promise<CommentResponseDto[]> {
    try {
      const { page = 1, limit = 20, sortBy = 'oldest' } = query;
      const offset = (page - 1) * limit;

    const replies = await this.loadRepliesRecursively(commentId, { 
      limit: Math.min(limit, 50), 
      offset,
    });

      return replies.map(reply => 
        plainToClass(CommentResponseDto, reply, { excludeExtraneousValues: true })
      );
    } catch (error) {
      this.handleDatabaseError(error, 'findReplies');
    }
  }

  private handleDatabaseError(error: any, operation: string): never {
    if (error.code === '23503') { // Foreign key violation
      throw new BadRequestException(`Invalid reference in ${operation}`);
    }
    if (error.code === '23505') { // Unique violation
      throw new BadRequestException(`Duplicate entry in ${operation}`);
    }
    throw new BadRequestException(`Database error in ${operation}: ${error.message}`);
  }
}
