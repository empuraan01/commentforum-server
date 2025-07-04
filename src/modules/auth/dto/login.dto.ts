import { IsNotEmpty, IsString } from "class-validator";

// DTO for login is way simpler becuase we dont need to handle so many edge cases. 
export class LoginDto{

    @IsString()
    @IsNotEmpty({ message: 'Username is required' })
    username: string;

    @IsString()
    @IsNotEmpty({ message: 'Password is required' })
    password: string;

}