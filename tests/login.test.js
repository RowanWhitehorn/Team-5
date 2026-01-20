const request = require('supertest');
const app = require('../app');

describe('Login', () => {

  test('Fails login with wrong credentials', async () => {
    const res = await request(app)
      .post('/')
      .send({
        username: 'wronguser',
        password: 'wrongpass'
      });

    expect(res.text).toContain('Invalid username or password');
  });

});
