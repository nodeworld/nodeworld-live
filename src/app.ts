import * as cors from "cors";
import * as express from "express";
import * as http from "http";
import * as socket from "socket.io";

// tslint:disable-next-line:no-var-requires
const cookieParser = require("socket.io-cookie-parser");

const expressApp = express();

expressApp.use(cors({ origin: "http://localhost:3000", credentials: true }));

const httpApp = new http.Server(expressApp);
const io = socket(httpApp, { path: "/" });

io.use(cookieParser(process.env.TOKEN_SECRET));

export { io, httpApp as app };
