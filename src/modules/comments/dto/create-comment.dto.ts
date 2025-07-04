import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Length, Validate, IsOptional, IsUUID } from "class-validator";
import { NoWhitespace } from "../../../utils/no-whitespace.validator";

export class CreateCommentDto {
    @IsNotEmpty()
    @IsString()
    @Length(1, 10000)
    @Transform(({ value }) => value?.trim())
    @Validate(NoWhitespace) //this is a custom validator that checks if the string contains only whitespace
    text: string;

    @IsOptional()
    @IsUUID()
    parentId: string;
}