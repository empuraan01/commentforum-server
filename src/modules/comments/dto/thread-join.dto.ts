import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class ThreadJoinDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  threadId: string;
}
