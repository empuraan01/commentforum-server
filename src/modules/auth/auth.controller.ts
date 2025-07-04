import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";



@Controller('auth')
export class AuthController{
    constructor(private readonly authService: AuthService){}

    @Post('register')
    @HttpCode(HttpStatus.CREATED) //201
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
