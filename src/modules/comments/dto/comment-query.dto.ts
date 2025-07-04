import { IsOptional, IsString, IsUUID, Min, Max, IsIn } from "class-validator";
import { Transform } from "class-transformer";

export class CommentQueryDto {
    @IsOptional()
    @Min(1)
    @Transform(({value}) => parseInt(value,10))
    page?: number;

    @IsOptional()
    @Min(1)
    @Max(100)
    @Transform(({value}) => parseInt(value,10))
    limit?: number;

    @IsOptional()
    @IsIn(['newest', 'oldest'])
    sortBy?: string;

    @IsOptional()
    @IsUUID()
    userId?: string;
}