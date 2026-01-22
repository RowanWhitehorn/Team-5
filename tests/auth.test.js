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



// --- Security-focused tests ---
// Continuation for Alan's Security code

describe('Authentication Security', () => {
  test('rejects weak password on signup', async () => {
    const res = await request(app)
      .post('/createaccount')
      .send({
        username: 'user1',
        email: 'test@test.com',
        password: '123',
        confirmPassword: '123'
      });
    expect(res.text).toMatch(/Password must be at least 6 characters/);
  });

  test('rejects mismatched passwords on signup', async () => {
    const res = await request(app)
      .post('/createaccount')
      .send({
        username: 'user2',
        email: 'test2@test.com',
        password: 'securePass',
        confirmPassword: 'wrongPass'
      });
    expect(res.text).toMatch(/Passwords do not match/);
  });

  test('rejects duplicate username on signup', async () => {
    // First signup
    await request(app)
      .post('/createaccount')
      .send({
        username: 'duplicateUser',
        email: 'dup@test.com',
        password: 'securePass',
        confirmPassword: 'securePass'
      });

    // Second signup with same username
    const res = await request(app)
      .post('/createaccount')
      .send({
        username: 'duplicateUser',
        email: 'dup2@test.com',
        password: 'securePass',
        confirmPassword: 'securePass'
      });

    expect(res.text).toMatch(/Username already taken/);
  });

  test('login fails with wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'user1', password: 'wrongPass' });
    expect(res.statusCode).toBe(404); // or whatever your app returns
  });
});
