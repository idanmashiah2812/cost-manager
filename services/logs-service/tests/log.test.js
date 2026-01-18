const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock the db connection for testing
jest.mock('../src/db', () => ({
  connectToMongo: jest.fn(() => Promise.resolve())
}));

// Mock the logger to avoid console output during tests
jest.mock('../src/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })
}));

// Mock the auditLog to avoid DB writes during tests
jest.mock('../src/logging/auditLog', () => ({
  auditLog: jest.fn()
}));

const app = require('../src/server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('GET /api/logs', () => {
  it('should return all logs', async () => {
    const Log = require('../models/Log');
    await Log.create({
      message: 'Test log 1',
      level: 'info',
      service: 'test-service'
    });
    await Log.create({
      message: 'Test log 2',
      level: 'error',
      service: 'test-service'
    });

    const response = await request(app)
      .get('/api/logs');

    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toHaveProperty('message', 'Test log 2'); // sorted by timestamp desc
    expect(response.body[1]).toHaveProperty('message', 'Test log 1');
  });

  it('should limit results when limit query param is provided', async () => {
    const Log = require('../models/Log');
    await Log.create({
      message: 'Test log 1',
      level: 'info',
      service: 'test-service'
    });
    await Log.create({
      message: 'Test log 2',
      level: 'error',
      service: 'test-service'
    });

    const response = await request(app)
      .get('/api/logs?limit=1');

    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(1);
  });
});
