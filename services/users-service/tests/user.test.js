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
  it('should add a user successfully', async () => {
    const response = await request(app)
      .post('/api/add')
      .send({
        id: 123,
        first_name: 'John',
        last_name: 'Doe',
        birthday: '1990-01-01'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id', 123);
    expect(response.body).toHaveProperty('first_name', 'John');
    expect(response.body).toHaveProperty('last_name', 'Doe');
  });

  it('should return error for duplicate user', async () => {
    const User = require('../models/User');
    await User.create({
      id: 123,
      first_name: 'John',
      last_name: 'Doe',
      birthday: new Date('1990-01-01')
    });

    const response = await request(app)
      .post('/api/add')
      .send({
        id: 123,
        first_name: 'Jane',
        last_name: 'Smith',
        birthday: '1991-01-01'
      });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('id', 'USER_EXISTS');
  });
});

describe('GET /api/users', () => {
  it('should return all users', async () => {
    const User = require('../models/User');
    await User.create({
      id: 123,
      first_name: 'John',
      last_name: 'Doe',
      birthday: new Date('1990-01-01')
    });
    await User.create({
      id: 124,
      first_name: 'Jane',
      last_name: 'Smith',
      birthday: new Date('1991-01-01')
    });

    const response = await request(app)
      .get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toHaveProperty('id', 123);
    expect(response.body[1]).toHaveProperty('id', 124);
  });
});

describe('GET /api/users/:id', () => {
  it('should return user details with total costs', async () => {
    const User = require('../models/User');
    const Cost = require('../models/Cost');

    await User.create({
      id: 123,
      first_name: 'John',
      last_name: 'Doe',
      birthday: new Date('1990-01-01')
    });

    await Cost.create({
      description: 'test',
      category: 'food',
      userid: 123,
      sum: 10.5
    });
    await Cost.create({
      description: 'test2',
      category: 'health',
      userid: 123,
      sum: 20.0
    });

    const response = await request(app)
      .get('/api/users/123');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('first_name', 'John');
    expect(response.body).toHaveProperty('last_name', 'Doe');
    expect(response.body).toHaveProperty('id', 123);
    expect(response.body).toHaveProperty('total', 30.5);
  });

  it('should return error for non-existent user', async () => {
    const response = await request(app)
      .get('/api/users/999');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('id', 'USER_NOT_FOUND');
  });
});
