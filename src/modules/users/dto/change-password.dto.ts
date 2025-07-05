import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
  })
  @Transform(({ value }) => value?.trim())
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  confirmPassword: string;
  // my service will handle the validation of the confirm password field
}
