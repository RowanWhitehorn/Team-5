const request = require('supertest');
const path = require('path');
const app = require('../app');

describe('File Upload', () => {
  test('uploads a valid image file', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', path.join(__dirname, 'testfiles', 'sample.png')); // put a sample file in tests/testfiles
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Upload successful/);
  });

  test('rejects invalid file type', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', path.join(__dirname, 'testfiles', 'sample.txt'));
    expect(res.statusCode).toBe(400); // or whatever your app returns
    expect(res.text).toMatch(/Invalid file type/);
  });

  test('rejects when no file is provided', async () => {
    const res = await request(app).post('/upload');
    expect(res.statusCode).toBe(400);
    expect(res.text).toMatch(/No file uploaded/);
  });
});
