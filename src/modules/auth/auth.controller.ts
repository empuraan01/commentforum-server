import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request} from "@nestjs/common";
import { Throttle } from '@nestjs/throttler';
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { customRateLimits } from "../../config/throttler.config";

@Controller('auth')
export class AuthController{
    constructor(private readonly authService: AuthService){}

    @Post('register')
    @HttpCode(HttpStatus.CREATED) //201
    @Throttle({ 
        default: customRateLimits.auth.register
    })
    async register(@Body() registerDto: RegisterDto){
        const user = await this.authService.register(registerDto);

        const {passwordHash, ...userWithoutPassword} = user; //we shouldnt return passwordhash to the frontend

        return{
            message: 'User registered successfully',
            user: userWithoutPassword,
        }
    }

    @Post('login')
    @HttpCode(HttpStatus.OK) //200
    @Throttle({ 
        default: customRateLimits.auth.login
    })
    async login(@Body() loginDto: LoginDto){
        return await this.authService.login(loginDto);
    }

    @UseGuards(JwtAuthGuard) //this is the part where Im enabling route protection
    @Get('profile')
    getProfile(@Request() req) {
        const { passwordHash, ...userWithoutPassword } = req.user;
        return userWithoutPassword;
  }
}
