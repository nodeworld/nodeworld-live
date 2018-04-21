import * as express from "express";
import * as http from "http";
import * as socket from "socket.io";
import * as cors from "cors";

const cookie_parser = require("socket.io-cookie-parser");

const express_app = express();

express_app.use(cors({ origin: "http://localhost:3000", credentials: true }));

const http_app = new http.Server(express_app);
const io = socket(http_app, { path: "/" });

io.use(cookie_parser(process.env.TOKEN_SECRET));

export { io, http_app as app }