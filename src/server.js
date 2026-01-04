require("dotenv").config();
require("./config/firebase");

const app = require("./app");
const cors = require("cors");

// Ensure CORS is allowed for all origins to match frontend expectation
app.use(cors({ origin: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
