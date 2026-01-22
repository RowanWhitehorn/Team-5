const request = require('supertest');
const app = require('../app');

describe('Session Security', () => {
  test('logout destroys session', async () => {
    const agent = request.agent(app);
    await agent.post('/login').send({ username: 'user1', password: 'securePass' });
    const res = await agent.get('/logout');
    expect(res.header['set-cookie']).toBeDefined(); // cookie cleared
  });

  test('protected route requires login', async () => {
    const res = await request(app).get('/home');
    expect(res.statusCode).toBe(302); // should redirect to login
  });
});
