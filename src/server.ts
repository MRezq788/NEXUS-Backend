import dotenv from "dotenv";

dotenv.config();

import "../firebase";

import app from "./app";

const PORT = parseInt(process.env.PORT || "3000");
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST as string, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
