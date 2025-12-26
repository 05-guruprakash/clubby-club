const { auth } = require("./src/config/firebase");

async function test() {
    try {
        const listUsersResult = await auth.listUsers(1);
        console.log("✅ Admin SDK initialized correctly. Found", listUsersResult.users.length, "users.");
    } catch (e) {
        console.error("❌ Admin SDK initialization FAILED:", e.message);
    }
}

test();
