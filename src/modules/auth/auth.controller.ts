import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request} from "@nestjs/common";
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { customRateLimits } from "../../config/throttler.config";

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ 
        default: customRateLimits.auth.register
    })
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ 
        status: HttpStatus.CREATED, 
        description: 'User registered successfully',
        schema: {
            properties: {
                message: { type: 'string', example: 'User registered successfully' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        username: { type: 'string' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
    @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Username already exists' })
    async register(@Body() registerDto: RegisterDto) {
        const user = await this.authService.register(registerDto);
        const {passwordHash, ...userWithoutPassword} = user;
        return {
            message: 'User registered successfully',
            user: userWithoutPassword,
        };
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ 
        default: customRateLimits.auth.login
    })
    @ApiOperation({ summary: 'Login with username and password' })
    @ApiResponse({ 
        status: HttpStatus.OK, 
        description: 'Login successful',
        schema: {
            properties: {
                access_token: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        username: { type: 'string' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
    async login(@Body() loginDto: LoginDto) {
        return await this.authService.login(loginDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ 
        status: HttpStatus.OK, 
        description: 'Profile retrieved successfully',
        schema: {
            properties: {
                id: { type: 'string', format: 'uuid' },
                username: { type: 'string' }
            }
        }
    })
    @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Not authenticated' })
    getProfile(@Request() req) {
        const { passwordHash, ...userWithoutPassword } = req.user;
        return userWithoutPassword;
    }
}
