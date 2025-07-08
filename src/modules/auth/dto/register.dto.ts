import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';



// DTOs are used to make sure that the data that is being sent to backend is valid.
// DTOs usually dont handle the businnes logic. just the validating of the format is done here.

export class RegisterDto{
    @ApiProperty({
        description: 'Username for registration',
        minLength: 3,
        maxLength: 50,
        example: 'john123',
        pattern: '^[a-zA-Z0-9]+$'
    })
    @IsString()
    @Length(3,50)
    // using regex becuase it is faster than a custom validator
    @Matches(/^[a-zA-Z0-9]+$/, { message: 'Username must contain only letters and numbers' })
    username: string;

    @ApiProperty({
        description: 'Password for registration',
        minLength: 8,
        maxLength: 100,
        example: 'Password123',
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$'
    })
    @IsString()
    @Length(8,100)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/, { 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
    })
    password: string;
}