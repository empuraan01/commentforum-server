export function getCorsOrigins(): string[] {
  return [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
}

export const corsConfig = {
  http: {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'X-File-Name'
    ],
    credentials: true,
    maxAge: 300,
    optionsSuccessStatus: 200,
  },
  websocket: {
    origin: getCorsOrigins(),
    credentials: true,
  }
}; 