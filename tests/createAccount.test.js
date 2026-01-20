const request = require('supertest');
const app = require('../app');

describe('Create Account', () => {

  test('Rejects empty form submission', async () => {
    const res = await request(app)
      .post('/createAccount')
      .send({});

    expect(res.text).toContain('All fields are required');
  });

  test('Rejects short password', async () => {
    const res = await request(app)
      .post('/createAccount')
      .send({
        username: 'testuser1',
        email: 'test@test.com',
        password: '123',
        confirmPassword: '123'
      });

    expect(res.text).toContain('Password must be at least 6 characters');
  });

});
