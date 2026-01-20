const request = require('supertest');
const app = require('../app');

describe('Delete indoor list', () => {

  test('Delete fails when user is not logged in', async () => {
    const res = await request(app)
      .post('/deleteListIndoor/1');

    expect(res.body.success).toBe(false);
  });

});
