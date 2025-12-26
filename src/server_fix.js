require("dotenv").config();
require("./config/firebase");
const app = require("./app");
const cors = require("cors");

// Allow CORS for frontend
app.use(cors({ origin: true }));

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ FIX Server running on port ${PORT}`);
    console.log(`Resource: http://localhost:${PORT}`);
});
