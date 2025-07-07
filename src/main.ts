import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { corsConfig, getCorsOrigins } from './config/cors.config';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));


  app.useGlobalFilters(new ThrottlerExceptionFilter());

  // swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Comment Forum API')
    .setDescription('A NestJS API for managing comments')
    .setVersion('1.0')
    .addBearerAuth() 
    .addTag('Comments', 'Comment management endpoints')
    .addTag('Auth', 'Authentication endpoints')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.enableCors(corsConfig.http);

  console.log('CORS enabled for origins:', getCorsOrigins());

  await app.listen(process.env.PORT ?? 3000);
  
  console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Swagger docs available at: http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
