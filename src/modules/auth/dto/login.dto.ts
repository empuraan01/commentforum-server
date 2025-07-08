import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

// DTO for login is way simpler becuase we dont need to handle so many edge cases. 
export class LoginDto{

    @ApiProperty({
        description: 'Username for login',
        example: 'john123'
    })
    @IsString()
    @IsNotEmpty({ message: 'Username is required' })
    username: string;

    @ApiProperty({
        description: 'Password for login',
        example: 'Password123'
    })
    @IsString()
    @IsNotEmpty({ message: 'Password is required' })
    password: string;

}