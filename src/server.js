const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Message Generator Web Service running on port ${PORT}`);
  console.log(`Access the interface at http://localhost:${PORT}`);
});
