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

describe('POST /api/add', () => {
  it('should add a cost item successfully', async () => {
    // First create a user since ENFORCE_USER_EXISTS is true
    const User = require('../models/User');
    await User.create({
      id: 123,
      first_name: 'Test',
      last_name: 'User',
      birthday: new Date('1990-01-01')
    });

    const response = await request(app)
      .post('/api/add')
      .send({
        description: 'test item',
        category: 'food',
        userid: 123,
        sum: 10.5
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('description', 'test item');
    expect(response.body).toHaveProperty('category', 'food');
    expect(response.body).toHaveProperty('userid', 123);
    expect(response.body).toHaveProperty('sum', 10.5);
  });

  it('should return error for invalid category', async () => {
    const User = require('../models/User');
    await User.create({
      id: 123,
      first_name: 'Test',
      last_name: 'User',
      birthday: new Date('1990-01-01')
    });

    const response = await request(app)
      .post('/api/add')
      .send({
        description: 'test item',
        category: 'invalid',
        userid: 123,
        sum: 10.5
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('id', 'UNSUPPORTED_CATEGORY');
  });

  it('should return error for non-existent user', async () => {
    const response = await request(app)
      .post('/api/add')
      .send({
        description: 'test item',
        category: 'food',
        userid: 999,
        sum: 10.5
      });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('id', 'USER_NOT_FOUND');
  });
});

describe('GET /api/report', () => {
  it('should return monthly report', async () => {
    const User = require('../models/User');
    const Cost = require('../models/Cost');

    await User.create({
      id: 123,
      first_name: 'Test',
      last_name: 'User',
      birthday: new Date('1990-01-01')
    });

    await Cost.create({
      description: 'choco',
      category: 'food',
      userid: 123,
      sum: 12,
      createdAt: new Date('2026-01-17')
    });

    const response = await request(app)
      .get('/api/report?id=123&year=2026&month=1');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('userid', 123);
    expect(response.body).toHaveProperty('year', 2026);
    expect(response.body).toHaveProperty('month', 1);
    expect(response.body.costs).toBeInstanceOf(Array);
    expect(response.body.costs[0]).toHaveProperty('food');
    expect(response.body.costs[0].food[0]).toHaveProperty('sum', 12);
    expect(response.body.costs[0].food[0]).toHaveProperty('description', 'choco');
    expect(response.body.costs[0].food[0]).toHaveProperty('day', 17);
  });
});
