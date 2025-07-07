import { 
  Controller, 
  Get, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  HttpStatus,
  ParseUUIDPipe,
  HttpCode,
  ValidationPipe
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
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserCommentsQueryDto } from './dto/user-comments-query.dto';
import { UserProfileResponseDto, PublicUserProfileDto } from './dto/user-profile-response.dto';
import { UserStatsDto } from './dto/users-stats.dto';
import { PaginatedUserCommentsResponseDto } from './dto/paginated-user-comments-response.dto';
import { customRateLimits } from '../../config/throttler.config';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

//private endpoints for the user

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get own user profile',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User profile retrieved successfully',
    type: UserProfileResponseDto 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserProfile(@Request() req): Promise<UserProfileResponseDto> {
    return this.usersService.getUserProfile(req.user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ 
    default: customRateLimits.users.updateProfile
  })
  @ApiOperation({ 
    summary: 'Update user profile',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User profile updated successfully',
    type: UserProfileResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Username already exists' })
  async updateUserProfile(
    @Request() req,
    @Body(ValidationPipe) updateUserProfileDto: UpdateUserProfileDto
  ): Promise<UserProfileResponseDto> {
    return this.usersService.updateUserProfile(req.user.id, updateUserProfileDto);
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ 
    default: customRateLimits.users.changePassword
  })
  @ApiOperation({ 
    summary: 'Change user password',
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async changePassword(
    @Request() req,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ 
    default: customRateLimits.users.deleteAccount
  })
  @ApiOperation({ 
    summary: 'Delete user account',
  })
  @ApiResponse({ status: 204, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUserAccount(@Request() req): Promise<void> {
    return this.usersService.deleteUserAccount(req.user.id);
  }

  //im also adding endpoints that are futureproof for admin dashboard

  @Get('profile/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get own profile (alias)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User profile retrieved successfully',
    type: UserProfileResponseDto 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getMyProfile(@Request() req): Promise<UserProfileResponseDto> {
    return this.usersService.getUserProfile(req.user.id);
  }

  @Get('stats/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get own statistics',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User statistics retrieved successfully',
    type: UserStatsDto 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getMyStats(@Request() req): Promise<UserStatsDto> {
    return this.usersService.getUserStats(req.user.id);
  }

  @Get('comments/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get own comments',
  })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['newest', 'oldest', 'most_replies'] })
  @ApiQuery({ name: 'topLevelOnly', required: false, type: 'boolean' })
  @ApiQuery({ name: 'includeDeleted', required: false, type: 'boolean' })
  @ApiQuery({ name: 'fromDate', required: false, type: 'string' })
  @ApiQuery({ name: 'toDate', required: false, type: 'string' })
  @ApiQuery({ name: 'minReplies', required: false, type: 'number' })
  @ApiResponse({ 
    status: 200, 
    description: 'User comments retrieved successfully',
    type: PaginatedUserCommentsResponseDto 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getMyComments(
    @Request() req,
    @Query() query: UserCommentsQueryDto
  ): Promise<PaginatedUserCommentsResponseDto> {
    return this.usersService.getUserComments(req.user.id, query);
  }


  // public endpoints for other users

  @Get(':id/profile/public')
  @ApiOperation({ 
    summary: 'Get public user profile',
  })
  @ApiParam({ name: 'id', description: 'User ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Public user profile retrieved successfully',
    type: PublicUserProfileDto 
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicUserProfile(
    @Param('id', ParseUUIDPipe) userId: string
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicUserProfile(userId);
  }

  @Get(':id/stats')
  @ApiOperation({ 
    summary: 'Get user statistics',
  })
  @ApiParam({ name: 'id', description: 'User ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User statistics retrieved successfully',
    type: UserStatsDto 
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserStats(
    @Param('id', ParseUUIDPipe) userId: string
  ): Promise<UserStatsDto> {
    return this.usersService.getUserStats(userId);
  }

  @Get(':id/comments')
  @ApiOperation({ 
    summary: 'Get user comments',
  })
  @ApiParam({ name: 'id', description: 'User ID', type: 'string' })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['newest', 'oldest', 'most_replies'], description: 'Sort order' })
  @ApiQuery({ name: 'topLevelOnly', required: false, type: 'boolean', description: 'Only show top-level comments' })
  @ApiQuery({ name: 'includeDeleted', required: false, type: 'boolean', description: 'Include deleted comments' })
  @ApiQuery({ name: 'fromDate', required: false, type: 'string', description: 'Filter from date (ISO string)' })
  @ApiQuery({ name: 'toDate', required: false, type: 'string', description: 'Filter to date (ISO string)' })
  @ApiQuery({ name: 'minReplies', required: false, type: 'number', description: 'Minimum number of replies' })
  @ApiResponse({ 
    status: 200, 
    description: 'User comments retrieved successfully',
    type: PaginatedUserCommentsResponseDto 
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserComments(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query() query: UserCommentsQueryDto
  ): Promise<PaginatedUserCommentsResponseDto> {
    return this.usersService.getUserComments(userId, query);
  }
}
