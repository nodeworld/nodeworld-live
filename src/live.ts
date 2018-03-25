import { app } from "./app";

require("./server");

const PORT = process.env.PORT || "4000";

app.listen(PORT, () => {
    console.log(`Nodeworld Live is now listening on localhost:${PORT}...`);
});