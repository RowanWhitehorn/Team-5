const request = require('supertest');
const path = require('path');
const app = require('../app');

// ============================================
// Authentication pages tests
// ============================================
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

// ============================================
// Authentication Security tests (Alan)
// ============================================
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

// ============================================
// Create Account tests
// ============================================
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

// ============================================
// Delete indoor list tests
// ============================================
describe('Delete indoor list', () => {

  test('Delete fails when user is not logged in', async () => {
    const res = await request(app)
      .post('/deleteListIndoor/1');

    expect(res.body.success).toBe(false);
  });

});

// ============================================
// Login tests
// ============================================
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

// ============================================
// Protected routes tests (Alan)
// ============================================
describe('Protected routes', () => {

  test('Redirects to login if not logged in', async () => {
    const res = await request(app).get('/homeListsIndoor');
    expect(res.statusCode).toBe(302); // redirect
  });

});

// ============================================
// Session Security tests (Alan)
// ============================================
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

// ============================================
// File Upload tests (Alan)
// ============================================
describe('File Upload', () => {
  test('uploads a valid image file', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', path.join(__dirname, 'testfiles', 'sample.png')); // put a sample file in tests/testfiles
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Upload successful/);
  });

  test('rejects invalid file type', async () => {
    let errorCaught = false;
    try {
      await request(app)
        .post('/upload')
        .attach('file', path.join(__dirname, 'testfiles', 'sample.txt'));
    } catch (err) {
      errorCaught = true;
      expect(err.message).toMatch(/ECONNRESET/);
    }
    expect(errorCaught).toBe(true);
  });

  test('rejects when no file is provided', async () => {
    const res = await request(app).post('/upload');
    expect(res.statusCode).toBe(400);
    expect(res.text).toMatch(/No file uploaded/);
  });
});

// ============================================
// Input Validation Security tests (Alan)
// ============================================
describe('Input Validation Security', () => {
  test('rejects script injection in description', async () => {
    const res = await request(app)
      .post('/addItem')
      .send({
        name: 'Lamp',
        description: '<script>alert("hack")</script>',
        priority: '1',
        estimatedCost: 100
      });
    expect(res.text).not.toMatch(/<script>/);
  });

  test('rejects invalid priority value', async () => {
    const res = await request(app)
      .post('/addItem')
      .send({
        name: 'Chair',
        description: 'Office chair',
        priority: '99', // invalid
        estimatedCost: 50
      });
    expect(res.statusCode).toBe(400);
  });
});
