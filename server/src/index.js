const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());
app.use(routes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
