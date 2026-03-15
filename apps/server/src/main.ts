import { db } from "./db/index.js";
import { buildApp } from "./server.js";

const app = buildApp({ db });

const start = async () => {
	const port = Number(process.env.PORT) || 3000;
	await app.listen({ port, host: "0.0.0.0" });
	console.log(`Server listening on http://localhost:${port}`);
};

start().catch((err) => {
	console.error(err);
	process.exit(1);
});
