import { app } from "./app";

import "./server";
import { logger } from "./utils/log";

const PORT = process.env.PORT || "4000";

app.listen(PORT, () => {
    logger.info(`Nodeworld Live is now listening on localhost:${PORT}...`);
});
