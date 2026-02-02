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
// Authentication Security tests
// ============================================
describe('Authentication Security', () => {

  test('rejects weak password on signup', async () => {
    const res = await request(app)
      .post('/createAccount')
      .send({
        username: 'weakpass',
        email: 'test@test.com',
        password: '123',
        confirmPassword: '123'
      });

    expect(res.text).toMatch(/Password must be at least 6 characters/);
  });

  test('rejects mismatched passwords on signup', async () => {
    const res = await request(app)
      .post('/createAccount')
      .send({
        username: 'mismatch',
        email: 'test2@test.com',
        password: 'securePass',
        confirmPassword: 'wrongPass'
      });

    expect(res.text).toMatch(/Passwords do not match/);
  });

  test('rejects duplicate username on signup', async () => {
    await request(app)
      .post('/createAccount')
      .send({
        username: 'duplicateUser',
        email: 'dup@test.com',
        password: 'securePass',
        confirmPassword: 'securePass'
      });

    const res = await request(app)
      .post('/createAccount')
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
      .send({ username: 'duplicateUser', password: 'wrongPass' });

    expect(res.statusCode).toBe(404);
  });

});

// ============================================
// Successful Login & Session tests (NEW)
// ============================================
describe('Successful Login', () => {

  test('successful login redirects to home', async () => {
    const agent = request.agent(app);

    await agent.post('/createAccount').send({
      username: 'loginUser',
      email: 'login@test.com',
      password: 'securePass',
      confirmPassword: 'securePass'
    });

    const res = await agent.post('/login').send({
      username: 'loginUser',
      password: 'securePass'
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/home');
  });

});

// ============================================
// Protected routes tests
// ============================================
describe('Protected routes', () => {

  test('Redirects to login if not logged in', async () => {
    const res = await request(app).get('/homeListsIndoor');
    expect(res.statusCode).toBe(302);
  });

  test('Logged-in user can access indoor list', async () => {
    const agent = request.agent(app);

    await agent.post('/createAccount').send({
      username: 'indoorUser',
      email: 'indoor@test.com',
      password: 'securePass',
      confirmPassword: 'securePass'
    });

    await agent.post('/login').send({
      username: 'indoorUser',
      password: 'securePass'
    });

    const res = await agent.get('/homeListsIndoor');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Indoor Home List');
  });

});

// ============================================
// Indoor list CRUD tests (NEW)
// ============================================
describe('Indoor list CRUD', () => {

  test('Add indoor item without image', async () => {
    const agent = request.agent(app);

    await agent.post('/createAccount').send({
      username: 'addUser',
      email: 'add@test.com',
      password: 'securePass',
      confirmPassword: 'securePass'
    });

    await agent.post('/login').send({
      username: 'addUser',
      password: 'securePass'
    });

    const res = await agent.post('/addListIndoor').send({
      itemOrfacility: 'Table',
      description: 'Wooden table',
      comment: 'Living room',
      priority: 2,
      estimatedCost: 200
    });

    expect(res.statusCode).toBe(302);
  });

  test('Delete indoor item when logged in', async () => {
    const agent = request.agent(app);

    await agent.post('/createAccount').send({
      username: 'deleteUser',
      email: 'delete@test.com',
      password: 'securePass',
      confirmPassword: 'securePass'
    });

    await agent.post('/login').send({
      username: 'deleteUser',
      password: 'securePass'
    });

    await agent.post('/addListIndoor').send({
      itemOrfacility: 'Sofa',
      description: 'Big sofa',
      comment: 'Hall',
      priority: 3,
      estimatedCost: 500
    });

    const res = await agent.post('/deleteListIndoor/1');
    expect(res.body.success).toBe(true);
  });

  test('Edit indoor item without image', async () => {
    const agent = request.agent(app);

    await agent.post('/createAccount').send({
      username: 'editUser',
      email: 'edit@test.com',
      password: 'securePass',
      confirmPassword: 'securePass'
    });

    await agent.post('/login').send({
      username: 'editUser',
      password: 'securePass'
    });

    await agent.post('/addListIndoor').send({
      itemOrfacility: 'Desk',
      description: 'Office desk',
      comment: 'Room',
      priority: 1,
      estimatedCost: 300
    });

    const res = await agent.post('/editListIndoor/1').send({
      itemOrfacility: 'Desk Updated',
      description: 'Updated desc',
      comment: 'Updated comment',
      priority: 2,
      estimatedCost: 350
    });

    expect(res.statusCode).toBe(302);
  });

});

// ============================================
// File Upload tests
// ============================================
describe('File Upload', () => {

  test('uploads a valid image file', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', path.join(__dirname, 'testfiles', 'sample.png'));

    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Upload successful/);
  });

  test('rejects when no file is provided', async () => {
    const res = await request(app).post('/upload');
    expect(res.statusCode).toBe(400);
    expect(res.text).toMatch(/No file uploaded/);
  });

});

// ============================================
// Input Validation Security tests
// ============================================
describe('Input Validation Security', () => {

  test('rejects script injection in description', async () => {
    const res = await request(app)
      .post('/addItem')
      .send({
        description: '<script>alert("hack")</script>',
        priority: '1'
      });

    expect(res.statusCode).toBe(400);
  });

  test('rejects invalid priority value', async () => {
    const res = await request(app)
      .post('/addItem')
      .send({
        description: 'Chair',
        priority: '99'
      });

    expect(res.statusCode).toBe(400);
  });

});
