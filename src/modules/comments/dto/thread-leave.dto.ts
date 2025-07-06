import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class ThreadLeaveDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  threadId: string;
}
