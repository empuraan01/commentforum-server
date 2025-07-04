import { IsNotEmpty, IsString, Length, Validate, } from "class-validator";
import { NoWhitespace } from "../../../utils/no-whitespace.validator";
import { Transform } from "class-transformer";

export class UpdateCommentDto {
    @IsNotEmpty()
    @IsString()
    @Length(1, 10000)
    @Transform(({ value }) => value?.trim())
    @Validate(NoWhitespace) 
    text: string;
}