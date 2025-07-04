import { Injectable, ConflictException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from 'bcrypt';
import { User } from "src/entities/user.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

// this service is responsible for the authentication logic
// there are methods to register, login, validate and lookup a user by username

@Injectable() // this basically makes the class available so that it can be exported and used in other modules
// the rest of the code is pretty self explanatory.
export class AuthService{
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private jwtService: JwtService,
    ){}

    async register(registerDto: RegisterDto): Promise<User> {
        const existingUser = await this.userRepository.findOne({
            where: { username: registerDto.username },
        });

        if (existingUser){
            throw new ConflictException('Username already exists');
        }

        const hashedPassword = await bcrypt.hash(registerDto.password, 12); // 12 is the number of rounds for the hashing algorithm

        const user = this.userRepository.create({
            username: registerDto.username,
            passwordHash: hashedPassword,
        });

        return await this.userRepository.save(user);
    }

    async validateUser(username: string, password: string): Promise<User | null>{
        const user = await this.findUserByUsername(username);
    
        if (user && await bcrypt.compare(password, user.passwordHash)) {
            return user;
        }
        
        return null;
    }

    async login(loginDto: LoginDto): Promise<{ accessToken: string }>{
        const user = await this.validateUser(loginDto.username, loginDto.password);

        if (!user){
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = {
            sub: user.id,
            username: user.username,
        };

        return {
            accessToken: this.jwtService.sign(payload), // this is the token that will be used to authenticate the user
        };
    }

    async findUserByUsername(username: string): Promise<User | null>{
        return await this.userRepository.findOne({
            where: { username }
        });
    }
}