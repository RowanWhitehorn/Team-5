const request = require('supertest');
const app = require('../app');

describe('Protected routes', () => {

  test('Redirects to login if not logged in', async () => {
    const res = await request(app).get('/homeListsIndoor');
    expect(res.statusCode).toBe(302); // redirect
  });

});
