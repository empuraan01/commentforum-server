import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { User } from "src/entities/user.entity";
import { AuthService } from "./auth.service";
import { ConfigService } from "@nestjs/config";

// this is the strategy for the jwt token
// it is used to validate the token and get the user from the database

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(
        configService: ConfigService, //this is not private because we need to access it in the constructor
        private authService: AuthService,
    ){
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: any): Promise<User>{
        const user = await this.authService.findUserByUsername(payload.username);

        if (!user){
            throw new UnauthorizedException('User not found');
        }

        return user;
    }
}