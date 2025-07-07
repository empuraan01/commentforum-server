import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    Query, 
    UseGuards, 
    Request,
    HttpStatus,
    ParseUUIDPipe
  } from '@nestjs/common';
import { 
    ApiTags, 
    ApiOperation, 
    ApiResponse, 
    ApiBearerAuth, 
    ApiQuery,
    ApiParam 
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { commentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import { ReplyQueryDto } from './dto/reply-query.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { PaginatedCommentsResponseDto } from './dto/paginated-comments-response.dto';
import { CommentStatsDto } from './dto/comments-stats.dto';
import { customRateLimits } from '../../config/throttler.config';

@ApiTags('Comments') // this decorator is used to group the comments related endpoints together
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: commentsService) {}

 // public endpoints like get all comments, get a comment by id, get comments by post id
 // these endpoints dont require authentication
  
  @Get()
  @ApiOperation({
    summary: 'Get all comments with pagination',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['newest', 'oldest'], description: 'Sort order (default: newest)' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Comments retrieved successfully',
    type: PaginatedCommentsResponseDto
  })
  async findAll(@Query() query: CommentQueryDto): Promise<PaginatedCommentsResponseDto> {
    return this.commentsService.findAllComments(query);
  }

  @Get('stats')
  @ApiOperation({ 
    summary: 'Get comment statistics',
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Statistics retrieved successfully',
    type: CommentStatsDto
  })
  async getStats(): Promise<CommentStatsDto> {
    return this.commentsService.getCommentStats();
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get comment by ID',
  })
  @ApiParam({ name: 'id', type: String, description: 'Comment UUID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Comment retrieved successfully',
    type: CommentResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Comment not found'
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CommentResponseDto> {
    return this.commentsService.findCommentById(id);
  }

  @Get(':id/replies')
  @ApiOperation({ 
    summary: 'Get replies to a comment',
  })
  @ApiParam({ name: 'id', type: String, description: 'Parent comment UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 50)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['oldest', 'newest'], description: 'Sort order (default: oldest)' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Replies retrieved successfully',
    type: [CommentResponseDto]
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Parent comment not found'
  })
  async findReplies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReplyQueryDto
  ): Promise<CommentResponseDto[]> {
    return this.commentsService.findReplies(id, query);
  }

// protected endpoints like create a comment, update a comment, delete a comment
// these endpoints require authentication

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ 
    default: customRateLimits.comments.create
  })
  @ApiOperation({ 
    summary: 'Create a new comment',
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Comment created successfully',
    type: CommentResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data'
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Authentication required'
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Parent comment not found (if replying)'
  })
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @Request() req: any
  ): Promise<CommentResponseDto> {
    return this.commentsService.createComment(createCommentDto, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ 
    default: customRateLimits.comments.update
  })
  @ApiOperation({ 
    summary: 'Update a comment',
  })
  @ApiParam({ name: 'id', type: String, description: 'Comment UUID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Comment updated successfully',
    type: CommentResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data or comment is deleted'
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Authentication required'
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'You can only update your own comments'
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Comment not found'
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() req: any
  ): Promise<CommentResponseDto> {
    return this.commentsService.updateComment(id, updateCommentDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ 
    default: customRateLimits.comments.delete
  })
  @ApiOperation({ 
    summary: 'Delete a comment',    
  })
  @ApiParam({ name: 'id', type: String, description: 'Comment UUID' })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Comment deleted successfully'
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Comment already deleted'
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Authentication required'
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'You can only delete your own comments'
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Comment not found'
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<void> {
    return this.commentsService.deleteComment(id, req.user.id);
  }
}