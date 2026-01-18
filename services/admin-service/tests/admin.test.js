const request = require('supertest');

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

describe('GET /api/about', () => {
  beforeEach(() => {
    // Clear env for clean test
    delete process.env.TEAM_MEMBERS_JSON;
  });

  it('should return empty array when TEAM_MEMBERS_JSON is not set', async () => {
    const response = await request(app)
      .get('/api/about');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('should return team members when TEAM_MEMBERS_JSON is set', async () => {
    process.env.TEAM_MEMBERS_JSON = '[{"first_name":"John","last_name":"Doe"}]';

    const response = await request(app)
      .get('/api/about');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { first_name: 'John', last_name: 'Doe' }
    ]);
  });

  it('should return error for invalid JSON in TEAM_MEMBERS_JSON', async () => {
    process.env.TEAM_MEMBERS_JSON = 'invalid json';

    const response = await request(app)
      .get('/api/about');

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('id', 'BAD_TEAM_ENV');
  });
});
