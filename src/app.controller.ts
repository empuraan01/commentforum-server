import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Get('rate-limit-info')
  getRateLimitInfo() {
    return {
      message: 'Rate limiting is active',
      limits: {
        auth: {
          login: '10 requests per 15 minutes',
          register: '5 requests per 15 minutes'
        },
        comments: {
          create: '30 requests per hour',
          update: '20 requests per hour',
          delete: '10 requests per hour'
        },
        users: {
          updateProfile: '10 requests per hour',
          changePassword: '3 requests per hour',
          deleteAccount: '1 request per day'
        },
        notifications: {
          create: '50 requests per hour',
          markRead: '200 requests per hour'
        },
        websocket: {
          connections: '10 per minute per IP',
          messages: '60 per minute per user',
          maxConnectionsPerUser: 5
        }
      },
      timestamp: new Date().toISOString()
    };
  }
}
