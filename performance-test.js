const autocannon = require('autocannon');

const instance = autocannon({
  url: 'http://your-application-url.com', // Replace with your actual application URL
  connections: 100, // Number of concurrent connections
  duration: 20, // Duration of the test in seconds
  requests: [
    { method: 'GET', path: '/' }, // Test the root route
    // Add more routes here if needed
  ],
});

autocannon.track(instance, { renderProgressBar: true });

instance.on('done', () => {
  console.log('Performance test completed!');
});
