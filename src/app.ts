import * as express from "express";
import * as http from "http";
import * as socket from "socket.io";

const express_app = express();
const http_app = new http.Server(express_app);
const io = socket(http_app);

export { io, http_app as app }