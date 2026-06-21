const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/users', (req, res) => {
  res.json({
    status: 200,
    users: [
      { id: 1, name: "TestUser" }
    ]
  });
});

app.get('/api/google_login/:token', (req, res) => {
  res.json({
    status: 200,
    data: {
      user_id: "999999",
      username: "BypassUser",
      token: req.params.token
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});