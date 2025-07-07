import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();


    const url = request.url;
    const method = request.method;
    
    let errorMessage = 'Too many requests';
    let retryAfter = 60; 
    
    if (url.includes('/auth/login')) {
      errorMessage = 'Too many login attempts. Please try again later.';
      retryAfter = 900; 
    } else if (url.includes('/auth/register')) {
      errorMessage = 'Too many registration attempts. Please try again later.';
      retryAfter = 900; 
    } else if (url.includes('/comments') && method === 'POST') {
      errorMessage = 'You are creating comments too quickly. Please wait a moment.';
      retryAfter = 120; 
    } else if (url.includes('/comments') && method === 'PUT') {
      errorMessage = 'You are updating comments too quickly. Please wait a moment.';
      retryAfter = 180; 
    } else if (url.includes('/users/profile') && method === 'PUT') {
      errorMessage = 'Profile updates are limited. Please wait before trying again.';
      retryAfter = 360; 
    } else if (url.includes('/users/password')) {
      errorMessage = 'Password change attempts are limited for security. Please wait.';
      retryAfter = 1200; 
    } else if (url.includes('/notifications') && method === 'POST') {
      errorMessage = 'You are creating notifications too quickly. Please slow down.';
      retryAfter = 72; 
    }

    const errorResponse = {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: errorMessage,
      error: 'Too Many Requests',
      timestamp: new Date().toISOString(),
      path: url,
      retryAfter: retryAfter,
      hint: `Please wait ${this.formatRetryAfter(retryAfter)} before trying again.`
    };

    response
      .status(HttpStatus.TOO_MANY_REQUESTS)
      .header('Retry-After', retryAfter.toString())
      .json(errorResponse);
  }

  private formatRetryAfter(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      const hours = Math.ceil(seconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  }
} 