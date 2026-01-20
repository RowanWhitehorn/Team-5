const request = require('supertest');
const app = require('../app');

describe('Authentication pages', () => {

  test('GET / should load login page', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('login');
  });

  test('GET /createAccount should load create account page', async () => {
    const res = await request(app).get('/createAccount');
    expect(res.statusCode).toBe(200);
  });

});
