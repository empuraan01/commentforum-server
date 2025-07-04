import { IsString, Length, Matches } from 'class-validator';



// DTOs are used to make sure that the data that is being sent to backend is valid.
// DTOs usually dont handle the businnes logic. just the validating of the format is done here.

export class RegisterDto{
    @IsString()
    @Length(3,50)
    // using regex becuase it is faster than a custom validator
    @Matches(/^[a-zA-Z0-9]+$/, { message: 'Username must contain only letters and numbers' })
    username: string;

    @IsString()
    @Length(8,100)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/, { 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
    })
    password: string;
}