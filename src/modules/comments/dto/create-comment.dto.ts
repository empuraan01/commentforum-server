import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Length, Validate, IsOptional, IsUUID } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoWhitespace } from "../../../utils/no-whitespace.validator";

export class CreateCommentDto {
    @ApiProperty({
        description: 'The comment text content',
        minLength: 1,
        maxLength: 10000,
        example: 'This is a comment'
    })
    @IsNotEmpty()
    @IsString()
    @Length(1, 10000)
    @Transform(({ value }) => value?.trim())
    @Validate(NoWhitespace) //this is a custom validator that checks if the string contains only whitespace
    text: string;

    @ApiPropertyOptional({
        description: 'ID of the parent comment (for replies)',
        example: '123e4567-e89b-12d3-a456-426614174000'
    })
    @IsOptional()
    @IsUUID()
    parentId: string;
}