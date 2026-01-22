const request = require('supertest');
const app = require('../app');

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
