import * as express from "express";
import * as http from "http";
import * as socket from "socket.io";
import * as cors from "cors";

const express_app = express();

express_app.use(cors({ origin: "http://localhost:3000", credentials: true }));

const http_app = new http.Server(express_app);
const io = socket(http_app, { path: "/" });

export { io, http_app as app }