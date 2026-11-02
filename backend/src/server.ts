
import "dotenv/config";
import { validateEnvironment } from "./config/env.js";

validateEnvironment();

const { app } = await import("./app.js");

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port number");
}

app.listen(port, () => {
  console.log(`Velora API listening on port ${port}`);
});
