import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../../entities/user.entity';
import { Comment } from '../../entities/comment.entity';
import { Notification } from '../../entities/notification.entity';

// this is the module that will handle the database connection

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('DB_HOST'),
                port: parseInt(configService.get('DB_PORT') || '5432', 10),
                username: configService.get('DB_USERNAME'),
                password: configService.get('DB_PASSWORD'),
                database: configService.get('DB_NAME'),
                entities: [User, Comment, Notification],
                synchronize: process.env.NODE_ENV === 'development',
                logging: process.env.NODE_ENV === 'development',
                extra: {
                    max: 10,
                    min: 2,
                    acquireTimeoutMillis: 30000,
                    idleTimeoutMillis: 30000,
                },
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                // these are performance settings for the database connection pool
                poolSize: 10,
                acquireTimeout: 60000,
                timeout: 60000,
                retryAttempts: 3,
                retryDelay: 3000,
            }),
            inject: [ConfigService],
        }),
    ],
    exports: [TypeOrmModule],
})
export class DatabaseModule {}