import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// this is used to protect the routes form being accessed by unauthorized users. will give a 401.
// this is similar to express middleware.