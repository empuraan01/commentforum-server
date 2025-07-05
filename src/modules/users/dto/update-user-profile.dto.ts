import { IsString, IsOptional, Length, Matches, IsNotEmpty, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { NoWhitespace } from '../../../utils/no-whitespace.validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  @Transform(({ value }) => value?.trim())
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, hyphens, and underscores'
  })
  @Validate(NoWhitespace)
  username?: string;

}
