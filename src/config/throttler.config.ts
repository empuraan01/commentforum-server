import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'short',
      ttl: 60000, 
      limit: 20, 
    },
    {
      name: 'medium', 
      ttl: 300000, 
      limit: 100, 
    },
    {
      name: 'long',
      ttl: 3600000, 
      limit: 1000, 
    },
  ],
};


export const customRateLimits = {
  auth: {
    login: { ttl: 900000, limit: 10 }, 
    register: { ttl: 900000, limit: 5 }, 
  },
  
  comments: {
    create: { ttl: 3600000, limit: 30 }, 
    update: { ttl: 3600000, limit: 20 }, 
    delete: { ttl: 3600000, limit: 10 }, 
  },
  
  users: {
    updateProfile: { ttl: 3600000, limit: 10 }, 
    changePassword: { ttl: 3600000, limit: 3 }, 
    deleteAccount: { ttl: 86400000, limit: 1 }, 
  },
  

  notifications: {
    create: { ttl: 3600000, limit: 50 }, 
    markRead: { ttl: 3600000, limit: 200 }, 
  },
  
  websocket: {
    connection: { ttl: 60000, limit: 10 }, 
    message: { ttl: 60000, limit: 60 }, 
  },
}; 